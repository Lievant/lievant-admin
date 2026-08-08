import { PartialType } from '@nestjs/mapped-types';
import { CreateFlowRecipientDto } from './create-flow-recipient.dto';

/** Todo opcional: la pantalla edita un campo a la vez (tipo, activo…). */
export class UpdateFlowRecipientDto extends PartialType(CreateFlowRecipientDto) {}
