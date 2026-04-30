// src/components/__tests__/RoomEntry.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoomEntry, { validateRoomId } from '../game/RoomEntry';
import { PlayerProvider } from '../../contexts/PlayerContext';

function renderRoomEntry(props: Partial<React.ComponentProps<typeof RoomEntry>> = {}) {
    const onJoin = props.onJoin ?? jest.fn();
    return render(
        <PlayerProvider>
            <MemoryRouter>
                <RoomEntry onJoin={onJoin} {...props} />
            </MemoryRouter>
        </PlayerProvider>
    );
}

describe('validateRoomId', () => {
    it('accepts non-empty strings', () => {
        expect(validateRoomId('room1')).toBe(true);
        expect(validateRoomId('  abc  ')).toBe(true);
    });

    it('rejects empty string', () => {
        expect(validateRoomId('')).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
        expect(validateRoomId('   ')).toBe(false);
        expect(validateRoomId('\t\n')).toBe(false);
    });
});

describe('RoomEntry component', () => {
    it('renders room ID input and submit button', () => {
        renderRoomEntry();
        expect(screen.getByLabelText('房间号')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '进入房间' })).toBeInTheDocument();
    });

    it('blocks submission when room ID is empty and shows error', () => {
        const onJoin = jest.fn();
        renderRoomEntry({ onJoin });
        fireEvent.click(screen.getByRole('button', { name: '进入房间' }));
        expect(onJoin).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('房间号不能为空');
    });

    it('blocks submission when room ID is whitespace-only', () => {
        const onJoin = jest.fn();
        renderRoomEntry({ onJoin });
        fireEvent.change(screen.getByLabelText('房间号'), { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: '进入房间' }));
        expect(onJoin).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls onJoin with trimmed room ID on valid submission', () => {
        const onJoin = jest.fn();
        renderRoomEntry({ onJoin });
        fireEvent.change(screen.getByLabelText('房间号'), { target: { value: '  room42  ' } });
        fireEvent.click(screen.getByRole('button', { name: '进入房间' }));
        expect(onJoin).toHaveBeenCalledWith('room42');
    });

    it('shows loading state when loading=true', () => {
        renderRoomEntry({ loading: true });
        expect(screen.getByRole('button', { name: /连接中/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /连接中/ })).toHaveAttribute('aria-busy', 'true');
    });

    it('disables input when loading', () => {
        renderRoomEntry({ loading: true });
        expect(screen.getByLabelText('房间号')).toBeDisabled();
    });

    it('displays external error message', () => {
        renderRoomEntry({ error: '连接服务器失败' });
        expect(screen.getByRole('alert')).toHaveTextContent('连接服务器失败');
    });

    it('shows anonymous user spectator notice when no nickname set', () => {
        // PlayerProvider with no stored nickname → anonymous
        localStorage.removeItem('player_nickname');
        renderRoomEntry();
        expect(screen.getByRole('note')).toBeInTheDocument();
        expect(screen.getByRole('note')).toHaveTextContent('匿名用户');
    });
});
