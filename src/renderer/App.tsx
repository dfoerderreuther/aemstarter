import React, { useState } from 'react';
import { MantineProvider, AppShell, Title, Container, Center, Paper, Text, ThemeIcon, Group, Stack, createTheme, rem } from '@mantine/core';
import '@mantine/core/styles.css';
import { ProjectList } from './components/ProjectList';
import { Project } from '../types/Project';
import { IconFolder } from '@tabler/icons-react';

const theme = createTheme({
  primaryColor: 'blue',
  components: {
    AppShell: {
      styles: (theme: any) => ({
        main: {
          background: theme.colors.dark[8],
        },
      }),
    },
  },
});

const App: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppShell
        header={{ height: 60 }}
        padding="md"
        style={{ minHeight: '100vh' }}
      >
        <AppShell.Header p="xs" style={{ display: 'flex', alignItems: 'center', paddingLeft: rem(20) }}>
          {selectedProject ? (
            <Group>
              <ThemeIcon size="lg" radius="md">
                <IconFolder size={20} />
              </ThemeIcon>
              <Title order={2}>{selectedProject.name}</Title>
            </Group>
          ) : (
            <Title order={1}>AEM Starter</Title>
          )}
        </AppShell.Header>

        <AppShell.Main>
          {selectedProject ? (
            <Container size="xl" py="md">
              <ProjectList onProjectSelect={setSelectedProject} selectedProject={selectedProject} />
            </Container>
          ) : (
            <Center style={{ height: 'calc(100vh - 60px)' }}>
              <Paper radius="md" p="xl" withBorder>
                <Stack gap="lg" align="center">
                  <ThemeIcon size={80} radius="md">
                    <IconFolder size={40} />
                  </ThemeIcon>
                  <Title order={2}>Welcome to AEM Starter</Title>
                  <Text size="lg" c="dimmed" ta="center" maw={400} py="md">
                    Create a new project to get started with your AEM development
                  </Text>
                  <ProjectList onProjectSelect={setSelectedProject} selectedProject={selectedProject} />
                </Stack>
              </Paper>
            </Center>
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
};

export default App; 