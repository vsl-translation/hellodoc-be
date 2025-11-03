import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UpdateProjectDto } from '../core/dto/update-project.dto';
import { CreateProjectDto } from '../core/dto/create-project.dto';
import { ProjectsService } from '../services/projects.service';

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  @MessagePattern('projects.create')
  create(@Payload() createprojectDto: CreateProjectDto) {
    return this.projectsService.create(createprojectDto);
  }

  @MessagePattern('projects.findAll')
  findAll() {
    return this.projectsService.findAll();
  }

  @MessagePattern('projects.findOne')
  findOne(@Payload() id: number) {
    return this.projectsService.findOne(id);
  }

  @MessagePattern('projects.update')
  update(@Payload() updateprojectDto: UpdateProjectDto) {
    return this.projectsService.update(updateprojectDto.id, updateprojectDto);
  }

  @MessagePattern('projects.remove')
  remove(@Payload() id: number) {
    return this.projectsService.remove(id);
  }
}
