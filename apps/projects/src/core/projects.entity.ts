import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Project {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    project_name: string;

    @Column()
    project_description: string;

    @Column()
    project_type: string;

    @Column()
    project_startDate: Date;

    @Column()
    project_endDate: Date;

    @Column()
    project_numOfDev: number;

    @Column()
    project_media: string;

    @Column()
    project_demo_link: string;

    @Column()
    customer_id: string;
}