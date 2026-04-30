// Unit tests for NicknameModal
// Validates: Requirements 3.1, 3.2, 3.3
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NicknameModal from '../NicknameModal';
import { PlayerProvider } from '../../contexts/PlayerContext';

function renderModal(onClose = jest.fn()) {
    return render(
        <PlayerProvider>
            <NicknameModal onClose={onClose} />
        </PlayerProvider>
    );
}

beforeEach(() => {
    localStorage.clear();
});

test('renders nickname input and action buttons', () => {
    renderModal();
    expect(screen.getByLabelText('昵称输入框')).toBeInTheDocument();
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('跳过')).toBeInTheDocument();
});

test('valid input confirms and calls onClose', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText('昵称输入框'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByText('确认'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('player_nickname')).toBe('Alice');
});

test('skip button calls onClose without setting nickname', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByText('跳过'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('player_nickname')).toBeNull();
});

test('empty input shows error and does not close', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByText('确认'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
});

test('whitespace-only input shows error and does not close', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText('昵称输入框'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('确认'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
});

test('input exceeding 16 characters (after trim) shows error', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText('昵称输入框'), { target: { value: 'a'.repeat(17) } });
    fireEvent.click(screen.getByText('确认'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
});

test('pressing Enter confirms valid nickname', () => {
    const onClose = jest.fn();
    renderModal(onClose);
    const input = screen.getByLabelText('昵称输入框');
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
});
