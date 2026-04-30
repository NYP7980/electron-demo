import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from '../NavBar';
import { PlayerProvider } from '../../contexts/PlayerContext';

function renderWithRouter(initialPath = '/demo') {
    return render(
        <PlayerProvider>
            <MemoryRouter initialEntries={[initialPath]}>
                <NavBar />
            </MemoryRouter>
        </PlayerProvider>
    );
}

test('renders both nav links', () => {
    renderWithRouter();
    expect(screen.getByText('功能演示')).toBeInTheDocument();
    expect(screen.getByText('游戏棋牌室')).toBeInTheDocument();
});

test('功能演示 link has active class when on /demo', () => {
    renderWithRouter('/demo');
    const demoLink = screen.getByText('功能演示');
    expect(demoLink).toHaveClass('navbar-link--active');
    expect(screen.getByText('游戏棋牌室')).not.toHaveClass('navbar-link--active');
});

test('游戏棋牌室 link has active class when on /game', () => {
    renderWithRouter('/game');
    const gameLink = screen.getByText('游戏棋牌室');
    expect(gameLink).toHaveClass('navbar-link--active');
    expect(screen.getByText('功能演示')).not.toHaveClass('navbar-link--active');
});
