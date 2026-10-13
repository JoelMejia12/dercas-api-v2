import { Injectable, NotFoundException } from '@nestjs/common';
import { CabinetEventQueryDto, CabinetListQueryDto } from './cabinet.dto';
import { CabinetRepository } from './cabinet.repository';

@Injectable()
export class CabinetService {
  constructor(private readonly cabinet: CabinetRepository) {}
  async findCabinets(query: CabinetListQueryDto) { const page = await this.cabinet.findCabinets(query); return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } }; }
  async findPositions(id: string) { const items = await this.cabinet.findPositions(id); if (!items) throw new NotFoundException(); return items; }
  async findKeyrings(query: CabinetListQueryDto) { const page = await this.cabinet.findKeyrings(query); return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } }; }
  async findEvents(query: CabinetEventQueryDto) { const page = await this.cabinet.findEvents(query); return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } }; }
}
