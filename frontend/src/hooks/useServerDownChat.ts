import { useEffect, useRef } from 'react';
import { SERVER_DOWN_EVENT } from '../services/apiClient';

/** 백엔드 연결이 끊기면 채팅에 안내를 한 번만 붙인다. 종료는 AuthProvider가 처리한다. */
export function useServerDownChat(append: (text: string) => void) {
  const appendRef = useRef(append);
  appendRef.current = append;

  useEffect(() => {
    const onDown = () => {
      appendRef.current('요청을 처리하지 못했습니다.');
      appendRef.current('잠시후 게임이 종료됩니다.');
    };
    window.addEventListener(SERVER_DOWN_EVENT, onDown);
    return () => window.removeEventListener(SERVER_DOWN_EVENT, onDown);
  }, []);
}
