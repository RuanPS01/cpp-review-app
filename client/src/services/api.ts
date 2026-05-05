import axios from 'axios';
import type { AISettings, Student } from '../types';

const API_BASE = 'http://localhost:3001/api';

export const api = {
  getStudents: () => axios.get<Student[]>(`${API_BASE}/students`),
  getSettings: () => axios.get<AISettings>(`${API_BASE}/settings`),
  saveSettings: (settings: AISettings) => axios.post(`${API_BASE}/settings`, settings),
  getStatements: (turma: string) => axios.get<Record<string, string>>(`${API_BASE}/statements`, { params: { turma } }),
  saveStatements: (turma: string, statements: Record<string, string>) => 
    axios.post(`${API_BASE}/statements`, { turma, statements }),
  getCode: (path: string) => axios.get<string>(`${API_BASE}/code`, { params: { path } }),
  updateGrade: (data: {
    turma: string;
    studentId: string;
    questionNum: number;
    score: number;
    comment: string;
  }) => axios.post(`${API_BASE}/update-grade`, data),
  analyzeCode: (data: {
    turma: string;
    questionNum: number;
    code: string;
  }) => axios.post(`${API_BASE}/analyze`, data),
  deleteTurma: (turmaName: string) => axios.delete(`${API_BASE}/turma/${turmaName}`),
  importTurma: (formData: FormData) => axios.post(`${API_BASE}/import`, formData),
  importGrades: (turma: string, grades: any) => axios.post(`${API_BASE}/import-grades`, { turma, grades }),
  exportGrades: (turma: string) => axios.get(`${API_BASE}/export-grades/${turma}`),
};
