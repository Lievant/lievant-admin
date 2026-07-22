import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('SES_FROM_EMAIL', 'no-reply@lievant.com');
    this.client = new SESClient({
      region: this.configService.get<string>('SES_REGION', 'us-east-1'),
    });
  }

  async sendWelcomeEmail(to: string, name: string, roleNames: string[]): Promise<void> {
    const firstName = name.split(' ')[0];
    const roles = roleNames.length ? roleNames.join(', ') : 'sin rol asignado';

    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: 'Bienvenido a Lievant Admin' },
        Body: {
          Html: {
            Data: `
              <p>Hola ${firstName},</p>
              <p>Se creó tu cuenta en el Sistema Administrativo de Lievant con el rol <strong>${roles}</strong>.</p>
              <p>Inicia sesión en <a href="https://dev.system.lievant.com">system.lievant.com</a> con tu cuenta corporativa de Microsoft (@lievant.com). Se te pedirá configurar la autenticación multifactor en tu primer acceso.</p>
              <p>Si no esperabas este correo, contacta a transformaciondigital@lievant.com.</p>
            `,
          },
        },
      },
    });

    try {
      await this.client.send(command);
    } catch (err) {
      this.logger.warn(`No se pudo enviar el correo de bienvenida a ${to}: ${(err as Error).message}`);
    }
  }
}
