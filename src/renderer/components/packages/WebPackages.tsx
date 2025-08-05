import React from 'react';
import { Stack, Text, Paper, Center } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import { Project } from "../../../types/Project";

interface WebPackagesProps {
    project: Project;
}

export const WebPackages: React.FC<WebPackagesProps> = ({ project: _project }) => {
    return (
        <Paper withBorder p="xl" bg="dark.6">
            <Center>
                <Stack align="center" gap="sm">
                    <IconWorld size={48} color="var(--mantine-color-gray-5)" />
                    <Text c="dimmed" size="lg">Web Packages</Text>
                    <Text c="dimmed" size="sm">Coming soon - manage packages from web repositories</Text>
                </Stack>
            </Center>
        </Paper>
    );
};