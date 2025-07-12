import { Button, Popover, Stack, Text, Checkbox } from '@mantine/core';
import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

interface LogFileSelectorProps {
  availableFiles: string[];
  selectedFiles: string[];
  onChange: (files: string[]) => void;
  onFocus?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const LogFileSelector = ({ availableFiles, selectedFiles, onChange, onFocus, size = 'xs' }: LogFileSelectorProps) => {
  const [opened, setOpened] = useState(false);

  const handleFileToggle = (file: string) => {
    const newSelection = selectedFiles.includes(file)
      ? selectedFiles.filter(f => f !== file)
      : [...selectedFiles, file];
    onChange(newSelection);
  };

  const getDisplayText = () => {
    if (selectedFiles.length === 0) return 'Select logs';
    if (selectedFiles.length === 1) return selectedFiles[0];
    return `${selectedFiles[0]} +${selectedFiles.length - 1}`;
  };

  const handlePopoverOpen = () => {
    if (onFocus) onFocus();
    setOpened(true);
  };

  return (
    <Popover
      width={200}
      position="bottom-start"
      opened={opened}
      onChange={setOpened}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button
          variant="default"
          size={size}
          onClick={handlePopoverOpen}
          rightSection={<IconChevronDown size={12} />}
          style={{
            fontSize: '11px',
            height: '28px',
            padding: '0 8px',
            maxWidth: '120px',
            justifyContent: 'space-between'
          }}
          styles={{
            label: {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: 'left'
            }
          }}
        >
          {getDisplayText()}
        </Button>
      </Popover.Target>
      
      <Popover.Dropdown style={{ maxHeight: '550px', overflowY: 'auto' }}>
        <Stack gap="xs">
          <Text size="xs" fw={500} c="dimmed">Select log files to monitor:</Text>
          {availableFiles.map((file) => (
            <Checkbox
              key={file}
              label={file}
              size="xs"
              checked={selectedFiles.includes(file)}
              onChange={() => handleFileToggle(file)}
              styles={{
                label: { fontSize: '11px' }
              }}
            />
          ))}
          {availableFiles.length === 0 && (
            <Text size="xs" c="dimmed">No log files available</Text>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}; 