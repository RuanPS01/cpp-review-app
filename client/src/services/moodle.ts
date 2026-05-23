
export interface TestCase {
  name: string;
  input: string;
  output: string;
  gradeReduction?: string;
}

export interface VplFile {
  name: string;
  encoding: 0 | 1; // 0 = texto, 1 = base64
  data: string;
}

export interface ExamQuestion {
  cmid: number;
  instanceId: number;
  name: string;
  description: string;
  startDate: number;
  dueDate: number;
  testCases: TestCase[];
  executionFiles: VplFile[];
}

export interface StudentQuestionSubmission {
  userId: number;
  fullName: string;
  email: string;
  questionCmid: number;
  files: VplFile[];
  submitted: boolean;
  lastResult?: {
    compilation: string;
    evaluation: string;
    grade: string;
  };
}

export interface ExamImport {
  courseId: number;
  courseName: string;
  sectionName: string;
  importedAt: number;
  questions: ExamQuestion[];
  studentSubmissions: StudentQuestionSubmission[];
}

const DEFAULT_BASE_URL = "https://moodle-teste.inatel.br";

export async function getToken(baseUrl: string, username: string, password: string, service: string = 'moodle_mobile_app') {
  const url = `${baseUrl || DEFAULT_BASE_URL}/login/token.php`;
  
  const body = new URLSearchParams({
    username,
    password,
    service
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.token;
}

export async function moodleCall(baseUrl: string, token: string, func: string, params: Record<string, any> = {}) {
  const url = `${baseUrl || DEFAULT_BASE_URL}/webservice/rest/server.php`;
  
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction: func,
    moodlewsrestformat: "json",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.exception) {
    throw new Error(`[${data.errorcode}] ${data.message}`);
  }

  return data;
}

export function parseCases(content: string): TestCase[] {
  const cases: TestCase[] = [];
  const blocks = content.split(/\n(?=Case\s*=)/i).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split("\n");
    const tc: Partial<TestCase> = {};
    let currentField: "input" | "output" | null = null;
    const buffer: string[] = [];

    const flushBuffer = () => {
      if (currentField && buffer.length > 0) {
        tc[currentField] = buffer.join("\n").trimEnd();
        buffer.length = 0;
      }
    };

    for (const line of lines) {
      if (/^Case\s*=/i.test(line)) {
        tc.name = line.replace(/^Case\s*=\s*/i, "").trim();
        currentField = null;
      } else if (/^Input\s*=/i.test(line)) {
        flushBuffer();
        currentField = "input";
        const val = line.replace(/^Input\s*=\s*/i, "");
        if (val) buffer.push(val);
      } else if (/^Output\s*=/i.test(line)) {
        flushBuffer();
        currentField = "output";
        const val = line.replace(/^Output\s*=\s*/i, "");
        if (val) buffer.push(val);
      } else if (/^Grade reduction\s*=/i.test(line)) {
        tc.gradeReduction = line.replace(/^Grade reduction\s*=\s*/i, "").trim();
      } else if (currentField) {
        buffer.push(line);
      }
    }

    flushBuffer();

    if (tc.name && tc.input !== undefined && tc.output !== undefined) {
      cases.push(tc as TestCase);
    }
  }

  return cases;
}

export async function searchCourses(baseUrl: string, token: string, query: string) {
  return moodleCall(baseUrl, token, "core_course_search_courses", {
    criterianame: "search",
    criteriavalue: query,
  });
}

export async function getCourseContents(baseUrl: string, token: string, courseId: number) {
  return moodleCall(baseUrl, token, "core_course_get_contents", { courseid: courseId });
}

export async function getEnrolledStudents(baseUrl: string, token: string, courseId: number) {
  const users = await moodleCall(baseUrl, token, "core_enrol_get_enrolled_users", { courseid: courseId });
  return users.filter((u: any) => u.roles?.some((r: any) => r.shortname === "student"));
}

export async function getVplInfo(baseUrl: string, token: string, cmid: number) {
  return moodleCall(baseUrl, token, "mod_vpl_info", { id: cmid });
}

export async function getStudentSubmission(baseUrl: string, token: string, cmid: number, userId: number) {
  return moodleCall(baseUrl, token, "mod_vpl_open", { id: cmid, userid: userId });
}

export async function getStudentResult(baseUrl: string, token: string, cmid: number, userId: number) {
  return moodleCall(baseUrl, token, "mod_vpl_get_result", { id: cmid, userid: userId });
}
