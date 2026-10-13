import { Injectable, NotFoundException } from '@nestjs/common';
import { GpsArchiveQueryDto, GpsPageQueryDto, GpsPositionHistoryQueryDto } from './gps-read.dto';
import { GpsReadRepository } from './gps-read.repository';

@Injectable()
export class GpsReadService {
  constructor(private readonly gps: GpsReadRepository) {}

  async findMySessions(userId: string, query: GpsPageQueryDto) {
    const page = await this.gps.findMySessions(userId, query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findMySessionPositions(id: string, userId: string, query: GpsPositionHistoryQueryDto) {
    const page = await this.gps.findSessionPositions(id, userId, query);
    if (!page) throw new NotFoundException();
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findMySession(id: string, userId: string) {
    const session = await this.gps.findMySession(id, userId);
    if (!session) throw new NotFoundException();
    return session;
  }

  async findRealtimeMap(query: GpsPageQueryDto) {
    const page = await this.gps.findRealtimeMap(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findVehiclePositions(vehicleId: string, query: GpsPositionHistoryQueryDto) {
    const page = await this.gps.findVehiclePositions(vehicleId, query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findManagedDevices(query: GpsPageQueryDto) {
    const page = await this.gps.findManagedDevices(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findManagedDevice(id: string) {
    const device = await this.gps.findManagedDevice(id);
    if (!device) throw new NotFoundException();
    return device;
  }

  async findArchives(query: GpsArchiveQueryDto) {
    const page = await this.gps.findArchives(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findMyRestorations(userId: string, query: GpsPageQueryDto) {
    const page = await this.gps.findMyRestorations(userId, query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findRestorationPositions(id: string, userId: string, query: GpsPositionHistoryQueryDto) {
    const page = await this.gps.findRestorationPositions(id, userId, query);
    if (!page) throw new NotFoundException();
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findConfiguration() {
    const config = await this.gps.findGpsConfiguration();
    if (!config) throw new NotFoundException();
    return config;
  }

  async findRetention() {
    const result = await this.gps.findRetentionSummary();
    if (!result) throw new NotFoundException();
    return result;
  }
}
