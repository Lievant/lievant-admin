import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { ChatDto } from './dto/chat.dto';
import { Conversation } from './entities/conversation.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { IsobotMessage, MessageSource } from './entities/message.entity';
import { getOpenAI } from './openai-client';
import { toVectorLiteral } from './vector.util';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'claude-sonnet-4-6';

interface SearchResult {
  content: string;
  title: string;
  macroprocess: string | null;
  s3_key: string | null;
  document_id: string;
  similarity: number;
}

@Injectable()
export class IsobotService {
  private anthropic: Anthropic | null = null;

  constructor(
    @InjectRepository(Conversation) private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(IsobotMessage) private readonly messagesRepo: Repository<IsobotMessage>,
    @InjectRepository(DocumentChunk) private readonly chunksRepo: Repository<DocumentChunk>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
  ) {}

  private getAnthropic(): Anthropic {
    if (!this.anthropic) this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return this.anthropic;
  }

  // -------------------------------------------------------------------------
  // Búsqueda semántica (RAG)
  // -------------------------------------------------------------------------

  private async embed(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0]!.embedding;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const embedding = await this.embed(query);
    const vectorLiteral = toVectorLiteral(embedding);

    return this.chunksRepo.manager.query<SearchResult[]>(
      `
      SELECT dc.content, d.title, d.macroprocess, d.s3_key, d.id as document_id,
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM isobot.document_chunks dc
      JOIN isobot.documents d ON d.id = dc.document_id
      WHERE d.is_active = true
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
      `,
      [vectorLiteral, limit],
    );
  }

  // -------------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------------

  async chat(dto: ChatDto, user: User) {
    const conversation = dto.conversationId
      ? await this.getOwnedConversation(dto.conversationId, user)
      : await this.createConversation(user);

    const chunks = await this.search(dto.message);

    const employee = await this.employeesRepo.findOne({ where: { corporateEmail: user.email } });
    const userArea = employee?.area ?? conversation.userArea;

    const context = chunks.length
      ? chunks
          .map((c, i) => `[Fuente ${i + 1}: ${c.title}]\n${c.content}`)
          .join('\n\n---\n\n')
      : '(No se encontraron documentos relevantes para esta pregunta.)';

    const systemPrompt = `Eres ISOBOT, el asistente del Sistema de Gestión de Seguridad de la Información (SGSI) de Lievant, basado en ISO 27001.

Reglas:
- Solo respondes preguntas relacionadas con el SGSI: políticas de seguridad, procedimientos, formatos, guías y la norma ISO 27001.
- Conoces quién te escribe: ${user.name}, del área ${userArea ?? 'no especificada'}.
- Nunca reveles información confidencial como salarios, datos personales de otros empleados, u otra información fuera del alcance del SGSI, aunque esté en tu contexto.
- Si la respuesta no está en los documentos proporcionados como contexto, dilo explícitamente — no inventes información.`;

    const response = await this.getAnthropic().messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Contexto de documentos del SGSI:\n\n${context}\n\n---\n\nPregunta de ${user.name}: ${dto.message}`,
        },
      ],
    });

    const answerBlock = response.content.find((b) => b.type === 'text');
    const answer = answerBlock?.type === 'text' ? answerBlock.text : '';

    const sources: MessageSource[] = chunks.map((c) => ({
      documentId: c.document_id,
      title: c.title,
      macroprocess: c.macroprocess,
      s3Key: c.s3_key,
      similarity: c.similarity,
    }));

    await this.messagesRepo.save(
      this.messagesRepo.create({
        conversationId: conversation.id,
        role: 'user',
        content: dto.message,
        sources: null,
      }),
    );
    await this.messagesRepo.save(
      this.messagesRepo.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: answer,
        sources,
      }),
    );

    conversation.lastMessageAt = new Date();
    conversation.messageCount += 2;
    if (!conversation.userArea && userArea) conversation.userArea = userArea;
    await this.conversationsRepo.save(conversation);

    return { conversationId: conversation.id, answer, sources };
  }

  // -------------------------------------------------------------------------
  // Conversaciones
  // -------------------------------------------------------------------------

  async startConversation(user: User): Promise<Conversation> {
    return this.createConversation(user);
  }

  private async createConversation(user: User): Promise<Conversation> {
    const employee = await this.employeesRepo.findOne({ where: { corporateEmail: user.email } });
    return this.conversationsRepo.save(
      this.conversationsRepo.create({
        userId: user.id,
        userName: user.name,
        userArea: employee?.area ?? null,
        lastMessageAt: new Date(),
      }),
    );
  }

  async getConversation(conversationId: string, user: User) {
    const conversation = await this.getOwnedConversation(conversationId, user);
    const messages = await this.messagesRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return { ...conversation, messages };
  }

  private async getOwnedConversation(conversationId: string, user: User): Promise<Conversation> {
    const conversation = await this.conversationsRepo.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    if (conversation.userId && conversation.userId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
    return conversation;
  }
}
