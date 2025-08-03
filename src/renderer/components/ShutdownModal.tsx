import React from 'react';
import { Modal, Stack, Text, Button, Group, Loader, ThemeIcon } from '@mantine/core';
import { IconPower } from '@tabler/icons-react';

interface ShutdownModalProps {
  opened: boolean;
  onForceQuit: () => void;
}

export const ShutdownModal: React.FC<ShutdownModalProps> = ({
  opened,
  onForceQuit
}) => {
  return (
    <Modal
      opened={opened}
      onClose={() => {}} // Prevent closing during shutdown
      title={
        <Group gap="sm">
          <ThemeIcon variant="light" color="orange" size="md">
            <IconPower size={16} />
          </ThemeIcon>
          <Text fw={500}>Shutting Down...</Text>
        </Group>
      }
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      overlayProps={{
        backgroundOpacity: 0.7,
        blur: 3,
      }}
      styles={{
        body: { padding: 'var(--mantine-spacing-lg)' },
        header: { 
          padding: 'var(--mantine-spacing-lg)', 
          borderBottom: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))' 
        }
      }}
    >
      <Stack gap="lg" align="center">
        <Group gap="md" align="center">
          <Loader size="sm" color="orange" />
          <Text size="sm" c="dimmed">
            Stopping running instances...
          </Text>
        </Group>
        
        <Text size="xs" ta="center" c="dimmed">
          This may take a few moments while we gracefully shut down your AEM instances and Dispatcher.
        </Text>
        
        <Button
          variant="outline"
          color="red"
          size="sm"
          onClick={onForceQuit}
          fullWidth
        >
          Force Quit
        </Button>
        
        <Text size="xs" ta="center" c="dimmed" fs="italic">
          Force quit will immediately close the application without waiting for instances to stop gracefully.
        </Text>
      </Stack>
    </Modal>
  );
};