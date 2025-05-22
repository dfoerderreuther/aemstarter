import { Project } from "../../types/Project";

interface AemInstanceViewProps {
  instance: string;
  project: Project;
}

export const AemInstanceView = ({ instance, project }: AemInstanceViewProps) => {
  return (
    <div>
      <h2>{instance}</h2>
      <div>Project: {project.name}</div>
    </div>
  );
}