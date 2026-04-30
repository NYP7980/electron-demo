import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// NavBar: renders both navigation links
test('NavBar renders 功能演示 link', () => {
  render(<App />);
  expect(screen.getByText('功能演示')).toBeInTheDocument();
});

test('NavBar renders 游戏棋牌室 link', () => {
  render(<App />);
  expect(screen.getByText('游戏棋牌室')).toBeInTheDocument();
});

// Default route: /demo renders FeatureDemoPage content
test('default route renders FeatureDemoPage', () => {
  render(<App />);
  // FeatureDemoPage mounts IpcPanel which contains "IPC 通信"
  expect(screen.getByText('IPC 通信')).toBeInTheDocument();
});
