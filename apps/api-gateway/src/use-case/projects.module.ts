import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProjectsController } from '../controller/projects.controller';
import { ProjectsService } from '../services/projects.service';

@Module({
  imports: [
    //ket noi gateway voi books service (ket noi dung giao thuc va port)
    ClientsModule.register([
      {
        name: 'PROJECTS_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3002,
        },
      },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule { }
