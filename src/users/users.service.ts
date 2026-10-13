import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersListQueryDto } from './users.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async getMyProfile(userId: string) {
    const profile = await this.users.findProfile(userId);
    if (!profile) throw new NotFoundException();
    return profile;
  }

  async getMyAccess(userId: string) {
    const access = await this.users.findAccess(userId);
    if (!access) throw new NotFoundException();
    return access;
  }

  async getUserAccess(userId: string) {
    const access = await this.users.findAccess(userId);
    if (!access) throw new NotFoundException();
    return access;
  }

  async listUsers(query: UsersListQueryDto) {
    const page = await this.users.findUsers(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async getUser(id: string) {
    const user = await this.users.findUserById(id);
    if (!user) throw new NotFoundException();
    return user;
  }
}
