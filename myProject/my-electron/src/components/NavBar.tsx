// src/components/NavBar.tsx
// 持久顶部导航栏：在功能演示和游戏棋牌室之间切换，高亮当前路由
// Settings icon opens NicknameModal when outside an active game
import { NavLink } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import './NavBar.css';

interface NavBarProps {
    onOpenNicknameModal?: () => void;
}

export default function NavBar({ onOpenNicknameModal }: NavBarProps) {
    const { state } = usePlayer();

    return (
        <header className="navbar">
            <span className="navbar-brand">Electron 应用</span>
            <nav className="navbar-links">
                <NavLink
                    to="/demo"
                    className={({ isActive }) => 'navbar-link' + (isActive ? ' navbar-link--active' : '')}
                >
                    功能演示
                </NavLink>
                <NavLink
                    to="/game"
                    className={({ isActive }) => 'navbar-link' + (isActive ? ' navbar-link--active' : '')}
                >
                    游戏棋牌室
                </NavLink>
            </nav>
            <button
                className="navbar-settings-btn"
                onClick={onOpenNicknameModal}
                title={state.nickname ? `昵称：${state.nickname}` : '设置昵称'}
                aria-label="设置昵称"
            >
                {state.nickname
                    ? <span className="navbar-nickname">{state.nickname}</span>
                    : <span className="navbar-anon">匿名</span>
                }
                <span className="navbar-settings-icon" aria-hidden="true">⚙</span>
            </button>
        </header>
    );
}
