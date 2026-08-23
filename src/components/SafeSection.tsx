"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 실패 시 대신 보여줄 내용. 없으면 아무것도 그리지 않는다. */
  fallback?: ReactNode;
  label?: string;
}

interface State {
  failed: boolean;
}

/**
 * 부가 기능 영역을 감싸는 에러 경계.
 *
 * 커플 연결처럼 없어도 되는 기능이 렌더 중 터졌을 때 화면 전체가 죽지 않게 한다.
 * 특히 ProfileForm 은 신규 사용자가 처음 만나는 화면이라, 여기서 터지면
 * 프로필 저장 자체를 못 하게 된다.
 */
export default class SafeSection extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[SafeSection${this.props.label ? `: ${this.props.label}` : ""}]`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
