#!/bin/sh
# Only the language is an argument. Source is read as a file, never shell code.
case "$1" in
  JAVA)
    cp /source/Main.java /work/Main.java || exit 125
    timeout -k 1s 10s javac -encoding UTF-8 -J-Xmx128m -J-XX:ActiveProcessorCount=1 Main.java
    result=$?
    if [ "$result" -eq 124 ]; then exit 124; fi
    if [ "$result" -ne 0 ]; then exit 10; fi
    timeout -k 1s 3s java -Dfile.encoding=UTF-8 -Xmx96m -XX:ActiveProcessorCount=1 -XX:-UsePerfData -cp /work Main
    ;;
  CPP)
    cp /source/main.cpp /work/main.cpp || exit 125
    timeout -k 1s 10s g++ -std=c++17 -O0 main.cpp -o /work/program
    result=$?
    if [ "$result" -eq 124 ]; then exit 124; fi
    if [ "$result" -ne 0 ]; then exit 10; fi
    timeout -k 1s 3s /work/program
    ;;
  PYTHON)
    cp /source/main.py /work/main.py || exit 125
    timeout -k 1s 3s python3 -I -B -c 'import ast; ast.parse(open("main.py", encoding="utf8").read())'
    result=$?
    if [ "$result" -eq 124 ]; then exit 124; fi
    if [ "$result" -ne 0 ]; then exit 10; fi
    timeout -k 1s 3s python3 -I -B main.py
    ;;
  *) exit 125 ;;
esac
result=$?
if [ "$result" -eq 124 ]; then exit 124; fi
if [ "$result" -ne 0 ]; then exit 11; fi
