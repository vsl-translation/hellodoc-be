import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { CreateProjectDto } from '../core/dto/create-project.dto';
import { UpdateProjectDto } from '../core/dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject('PROJECTS_CLIENT') private projectsClient: ClientProxy) { }
  create(createprojectDto: CreateProjectDto) {
    return this.projectsClient.send('projects.create', createprojectDto);
  }

  findAll() {
    return this.projectsClient.send('projects.findAll', {});
  }

  findOne(id: number) {
    return this.projectsClient.send('projects.findOne', id);
  }

  update(id: number, updateprojectDto: UpdateProjectDto) {
    return this.projectsClient.send('projects.update', { id, ...updateprojectDto });
  }

  remove(id: number) {
    return this.projectsClient.send('projects.remove', id);
  }
}
