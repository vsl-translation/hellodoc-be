import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../core/projects.entity';


@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) { }
  async findAll(): Promise<Project[]> {
    return this.projectRepository.find();
  }

  async findOne(id: number): Promise<Project> {
    return this.projectRepository.findOne({ where: { id } });
  }

  async create(bookData: Project): Promise<Project> {
    const book = this.projectRepository.create(bookData);
    return this.projectRepository.save(book);
  }

  async update(id: number, bookData: Partial<Project>): Promise<Project> {
    await this.projectRepository.update(id, bookData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.projectRepository.delete(id);
  }
}
