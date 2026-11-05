// Reviewed language variants. These overlays leave the source question bank intact.
const code = {};
function add(id, java, python, cpp) {
  code[id] = { JAVA: java, PYTHON: python, CPP: cpp };
}
add('M02', `int n = 11;
boolean isPrime = true;
for (int i = 2; i < n; i++) {
    if (n % i == _____) { isPrime = _____; break; }
}
System.out.println(isPrime);`, `n = 11
isPrime = True
for i in range(2, n):
    if n % i == _____:
        isPrime = _____
        break
print(isPrime)`, `int n = 11;
bool isPrime = true;
for (int i = 2; i < n; i++) {
    if (n % i == _____) { isPrime = _____; break; }
}
std::cout << std::boolalpha << isPrime << std::endl;`);
add('M05', `String s = "hello";
String rev = "";
for (int i = s._____() - 1; i >= 0; i_____) {
    rev += s.charAt(i);
}
System.out.println(rev);`, `s = "hello"
rev = ""
i = _____(s) - 1
while i >= 0:
    rev += s[i]
    i_____
print(rev)`, `std::string s = "hello";
std::string rev = "";
for (int i = s._____() - 1; i >= 0; i_____) {
    rev += s[i];
}
std::cout << rev << std::endl;`);
add('V01', `for (int i = 1; i <= 5; i++) {
  for (int j = 0; j < _____; j++) System.out.print(" ");
  for (int k = 0; k < _____; k++) System.out.print("*");
  System.out.println();
}`, `for i in range(1, 6):
    print(" " * (_____) + "*" * (_____))`, `for (int i = 1; i <= 5; i++) {
  for (int j = 0; j < _____; j++) std::cout << " ";
  for (int k = 0; k < _____; k++) std::cout << "*";
  std::cout << std::endl;
}`);
add('V02', `for (int i = 1; i <= 4; i++) {
  for (int j = 0; j < _____; j++) System.out.print("*");
  System.out.println();
}`, `for i in range(1, 5):
    print("*" * (_____))`, `for (int i = 1; i <= 4; i++) {
  for (int j = 0; j < _____; j++) std::cout << "*";
  std::cout << std::endl;
}`);
add('V03', `for (int i = 5; i >= 1; i_____) {
  for (int j = 0; j < i; j++) System.out.print("*");
  System.out.println();
}`, `i = 5
while i >= 1:
    print("*" * i)
    i_____`, `for (int i = 5; i >= 1; i_____) {
  for (int j = 0; j < i; j++) std::cout << "*";
  std::cout << std::endl;
}`);
add('V04', `for (int i = 1; i <= 3; i++) {
  for (int j = 0; j < 3-i; j++) System.out.print(" ");
  for (int j = 0; j < 2*i-1; j++) System.out.print("_____");
  System.out.println();
}
for (int i = 2; i >= 1; i--) {
  for (int j = 0; j < 3-i; j++) System.out.print(" ");
  for (int j = 0; j < 2*i-1; j++) System.out.print("_____");
  System.out.println();
}`, `for i in range(1, 4):
    print(" " * (3-i) + _____ * (2*i-1))
for i in range(2, 0, -1):
    print(" " * (3-i) + _____ * (2*i-1))`, `for (int i = 1; i <= 3; i++) {
  std::cout << std::string(3-i, ' ') << std::string(2*i-1, "_____"[0]) << std::endl;
}
for (int i = 2; i >= 1; i--) {
  std::cout << std::string(3-i, ' ') << std::string(2*i-1, "_____"[0]) << std::endl;
}`);
add('V05', `for (int i = 1; i <= 3; i++) {
  for (int j = 1; j <= _____; j++) System.out.print(j);
  System.out.println();
}`, `for i in range(1, 4):
    for j in range(1, (_____) + 1):
        print(j, end="")
    print()`, `for (int i = 1; i <= 3; i++) {
  for (int j = 1; j <= _____; j++) std::cout << j;
  std::cout << std::endl;
}`);
add('V06', `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) {
    if (i==0 || i==3 || j==0 || j==3) System.out.print("*");
    else System.out.print("_____");
  }
  System.out.println();
}`, `for i in range(4):
    for j in range(4):
        print("*" if i==0 or i==3 or j==0 or j==3 else "_____", end="")
    print()`, `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) std::cout << ((i==0 || i==3 || j==0 || j==3) ? "*" : "_____");
  std::cout << std::endl;
}`);
add('V07', `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) System.out.print((i+j)%2==0 ? "#" : "_____");
  System.out.println();
}`, `for i in range(4):
    for j in range(4):
        print("#" if (i+j)%2==0 else "_____", end="")
    print()`, `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) std::cout << ((i+j)%2==0 ? "#" : "_____");
  std::cout << std::endl;
}`);
add('V08', `for (int i = 1; i <= 3; i++) {
  for (int j = 0; j < 3-i; j++) System.out.print(" ");
  for (int k = 0; k < 2*i-1; k++) System.out.print("*");
  System.out.println();
}
System.out.println("  _____");`, `for i in range(1, 4):
    print(" " * (3-i) + "*" * (2*i-1))
print("  _____")`, `for (int i = 1; i <= 3; i++) {
  std::cout << std::string(3-i, ' ') << std::string(2*i-1, '*') << std::endl;
}
std::cout << "  _____" << std::endl;`);
add('SV01', `for (int i = 0; i < 5; i++) {
  for (int j = 0; j <= i; j++) System.out.print("_____");
  System.out.println();
}`, `for i in range(5):
    print(_____ * (i+1))`, `for (int i = 0; i < 5; i++) {
  for (int j = 0; j <= i; j++) std::cout << "_____";
  std::cout << std::endl;
}`);
add('SV02', `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) System.out.print("_____");
  System.out.println();
}`, `for i in range(4):
    print(_____ * 4)`, `for (int i = 0; i < 4; i++) {
  for (int j = 0; j < 4; j++) std::cout << "_____";
  std::cout << std::endl;
}`);
add('SV03', `// 원 둘레 = 2 * _____ * r
double radius = 2;
double circumference = 2 * _____ * radius;
System.out.println(circumference);`, `import math
# 원 둘레 = 2 * _____ * r
radius = 2
circumference = 2 * _____ * radius
print(circumference)`, `// 원 둘레 = 2 * _____ * r
double radius = 2;
double circumference = 2 * _____ * radius;
std::cout << circumference << std::endl;`);

const unavailable = {
  PYTHON: new Set(['E17', 'E18', 'X06', 'X09', 'X11', 'X27', 'H01', 'H04', 'H18']),
  JAVA: new Set(['H01', 'H04']),
  CPP: new Set(['X15', 'X19']),
};
const wording = {
  PYTHON: {
    E01: '정수형으로 값을 변환하는 내장 함수의 이름은? (예: _____("10"))',
    E04: 'flag = False일 때 if not _____: 조건이 참이 되도록 변수명을 입력하세요.',
    E11: '문자 한 글자를 포함한 문자열을 저장하는 자료형의 이름은? (예: c = _____("A"))',
    M01: '리스트 arr의 요소 개수를 구하는 표현식은? (함수 호출 전체 입력)',
    M15: '문자열 s의 0번째 문자를 가져오는 인덱싱 표현식은? (s 다음에 붙는 부분 입력)',
    M18: '"cd" in "abcdef" 식을 평가한 Python의 불리언 결과는?',
    X03: 'Animal을 상속하는 class Dog_____: 선언에서 빈칸에 들어가는 부분은?',
    X08: '인스턴스 메서드에서 자기 자신을 받는 첫 매개변수의 관례적인 이름은?',
    X10: '아무 값도 반환하지 않는 함수의 호출 결과를 나타내는 값은?',
    X19: '"ABC"._____ "abc" 식으로 대소문자를 무시한 동등 비교를 하려고 합니다. 빈칸에 메서드 호출과 비교 연산자를 입력하세요.',
  },
  CPP: { X13: 'std::string에서 널 종료 문자 배열을 읽기 위한 포인터를 반환하는 메서드는?', H04: 'int x = 10; int& ref = x; ref = 5; 실행 후 x의 값은?' },
};

export function applyLanguageVariant(problem, language) {
  if (unavailable[language]?.has(problem.id)) return null;
  let question = code[problem.id]?.[language] || wording[language]?.[problem.id] || problem.question;
  let executionKind = code[problem.id]?.[language] ? 'body' : undefined;
  if (problem.id === 'LJ01') executionKind = 'body';
  if (problem.id === 'LC01') executionKind = 'program';
  if (problem.id === 'LC03') {
    question = `${question}\nint main() { int x = 1; inc(x); std::cout << x << std::endl; }`;
    executionKind = 'program';
  }
  if (problem.id === 'LP03') { question = `score = 75\n${question}\nprint(status)`; executionKind = 'body'; }
  const booleanChoice = problem.id === 'M18' && language === 'PYTHON'
    ? { answer: { ...problem.answer, PYTHON: ['True'] }, options: ['True', 'False', 'None', '오류'], correctIndex: 0 } : {};
  return { ...problem, ...booleanChoice, language, question, executionKind };
}

export function wrapExecutionSource(source, language, kind = 'body') {
  if (language === 'PYTHON') return source;
  if (language === 'JAVA') return kind === 'program' ? source : `public class Main {\npublic static void main(String[] args) throws Exception {\n${source}\n}\n}`;
  if (language === 'CPP') return `#include <iostream>\n#include <string>\n#include <vector>\n#include <cmath>\n${kind === 'program' ? source : `int main() {\n${source}\nreturn 0;\n}`}`;
  throw new Error('Unsupported execution language');
}
