import { FC } from 'react';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ChevronDown } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box } from '../primitives/box';

interface CollapseButtonProps {
    onPressHandler: () => void;
    backgroundColor?: string;
    iconColor?: string;
}

const styles = StyleSheet.create((theme) => ({
    container: (backgroundColor?: string) => ({
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: backgroundColor || theme.colors.accentStrong,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    }),
    icon: {
        marginTop: theme.space(0.5),
    },
}));

const CollapseButton: FC<CollapseButtonProps> = ({
    onPressHandler,
    backgroundColor,
    iconColor,
}) => {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onPressHandler}>
            <Box style={styles.container(backgroundColor)}>
                <ChevronDown
                    style={styles.icon}
                    size={theme.space(7)}
                    color={iconColor || theme.colors.neutral[950]}
                />
            </Box>
        </Pressable>
    );
};

export { CollapseButton };
