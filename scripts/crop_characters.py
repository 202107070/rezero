"""레거시: 외부 애니 시트 크롭은 저작권 이슈로 폐기.

오리지널 캐릭터는 generate_original_characters.py 를 사용하세요.
"""
from __future__ import annotations

import runpy
from pathlib import Path


def main() -> None:
    target = Path(__file__).with_name("generate_original_characters.py")
    runpy.run_path(str(target), run_name="__main__")


if __name__ == "__main__":
    main()
