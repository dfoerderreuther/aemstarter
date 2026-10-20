import { Project } from '../../types/Project';
import { CodeAssistantTab } from './CodeAssistantTab';

interface ClaudeCodeTabProps {
  project: Project;
  visible?: boolean;
}

export const ClaudeCodeTab = ({ project, visible = true }: ClaudeCodeTabProps) => (
  <CodeAssistantTab project={project} visible={visible} assistant="claude" />
);
