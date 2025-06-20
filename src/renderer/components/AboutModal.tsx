import { Modal, Stack, Text, Group, ThemeIcon, Button, Anchor } from '@mantine/core';
import { IconBrandGithub, IconLicense } from '@tabler/icons-react';
import AemLogo from '../assets/AEM.svg';

interface AboutModalProps {
  opened: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ opened, onClose }) => {

  const handleOpenGitHub = () => {
    window.electronAPI.openUrl('https://github.com/dfoerderreuther/aemstarter');
  };

  return (
    <Modal opened={opened} onClose={onClose} title="About AEM-Starter" size="md" centered>
      <Stack gap="lg" align="center">
        <ThemeIcon size={80} radius="md" variant="transparent">
          <img src={AemLogo} alt="AEM Logo" style={{ width: 64, height: 64 }} />
        </ThemeIcon>
        
        <Stack gap="sm" align="center">
          <Text size="xl" fw={600}>AEM-Starter</Text>
          <Text size="lg" c="dimmed">Version 1.0.1</Text>
        </Stack>
        
        <Text size="md" ta="center" maw={400}>
          A development environment for Adobe Experience Manager (CS) that simplifies project setup, instance management, and development workflows.
        </Text>
        
        <Stack gap="xs" align="center">
          <Group gap="xs">
            <IconBrandGithub size={16} />
            <Anchor 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                handleOpenGitHub();
              }}
            >
              https://github.com/dfoerderreuther/aemstarter
            </Anchor>
          </Group>
          
          <Group gap="xs">
            <IconLicense size={16} />
            <Text size="sm" c="dimmed">MIT License</Text>
          </Group>
        </Stack>
        
        <Button onClick={onClose} mt="md">
          Close
        </Button>
      </Stack>
    </Modal>
  );
}; 