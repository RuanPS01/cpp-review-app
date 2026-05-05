import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Student, PendingChanges } from '../types';
import toast from 'react-hot-toast';

export const useReviewLogic = (
  students: Student[],
  currentIndex: number,
  currentQ: number,
  pendingChanges: PendingChanges,
  setPendingChanges: React.Dispatch<React.SetStateAction<PendingChanges>>,
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>,
  t: any
) => {
  const [code, setCode] = useState('');
  const [tempCode, setTempCode] = useState('');
  const [editScore, setEditScore] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCode = useCallback(async (path: string) => {
    try {
      const res = await api.getCode(path);
      setCode(res.data);
      setTempCode(res.data);
    } catch {
      const errorMsg = '// Error loading file: ' + path;
      setCode(errorMsg);
      setTempCode(errorMsg);
    }
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      const student = students[currentIndex];
      if (student) {
        const qKey = `q${currentQ}`;
        const pending = pendingChanges[student.folder_name]?.[qKey];
        const q = student.questions[qKey];
        if (q) {
            setEditScore(q.path ? (pending ? pending.score : q.score) : 0);
            setEditComment(pending ? pending.comment : q.comment);
            if (q.path) {
              fetchCode(q.path);
            } else {
              setCode('// No implementation found for this question');
              setTempCode('// No implementation found for this question');
            }
        } else {
            setEditScore(0);
            setEditComment('');
            setCode('// No implementation found for this question');
            setTempCode('// No implementation found for this question');
        }
      }
    }
  }, [currentIndex, currentQ, students, fetchCode, pendingChanges]);

  const handleEditChange = (score: number, comment: string) => {
    const student = students[currentIndex];
    if (!student) return;
    const qKey = `q${currentQ}`;
    const original = student.questions[qKey];
    
    // Force 0 score if no path
    const finalScore = (original && original.path) ? score : 0;

    setEditScore(finalScore);
    setEditComment(comment);
    
    if (!original) return;

    const isDirty = original.score !== finalScore || original.comment !== comment;
    
    setPendingChanges(prev => {
        const newPending = { ...prev };
        if (isDirty) {
            newPending[student.folder_name] = {
                ...(newPending[student.folder_name] || {}),
                [qKey]: { score: finalScore, comment }
            };
        } else {
            if (newPending[student.folder_name]) {
                delete newPending[student.folder_name][qKey];
                if (Object.keys(newPending[student.folder_name]).length === 0) {
                    delete newPending[student.folder_name];
                }
            }
        }
        return newPending;
    });
  };

  const handleSave = async (studentIdx = currentIndex, questionNum = currentQ) => {
    setSaving(true);
    const student = students[studentIdx];
    const qKey = `q${questionNum}`;
    const pending = pendingChanges[student.folder_name]?.[qKey];
    
    const original = student.questions[qKey];
    const scoreToSave = (original && original.path) ? (pending ? pending.score : editScore) : 0;
    const commentToSave = pending ? pending.comment : editComment;

    try {
      await api.updateGrade({
        turma: student.turma,
        studentId: student.folder_name,
        questionNum: questionNum,
        score: scoreToSave,
        comment: commentToSave
      });
      
      setStudents(prev => {
        const updated = [...prev];
        const targetStudent = updated[studentIdx];
        if (targetStudent && targetStudent.questions[qKey]) {
            targetStudent.questions[qKey].score = scoreToSave;
            targetStudent.questions[qKey].comment = commentToSave;
        }
        return updated;
      });

      setPendingChanges(prev => {
        const newPending = { ...prev };
        if (newPending[student.folder_name]) {
            delete newPending[student.folder_name][qKey];
            if (Object.keys(newPending[student.folder_name]).length === 0) {
                delete newPending[student.folder_name];
            }
        }
        return newPending;
      });

      toast.success(t.gradeSaved);
    } catch {
      toast.error('Error saving grade');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const student = students[currentIndex];
    if (!student) return;
    const studentPending = pendingChanges[student.folder_name];
    if (!studentPending) return;

    setSaving(true);
    try {
        const promises = Object.keys(studentPending).map(async (qKey) => {
            const qNum = parseInt(qKey.replace('q', ''));
            const data = studentPending[qKey];
            return api.updateGrade({
                turma: student.turma,
                studentId: student.folder_name,
                questionNum: qNum,
                score: data.score,
                comment: data.comment
            });
        });

        await Promise.all(promises);

        setStudents(prev => {
            const updated = [...prev];
            const sIdx = updated.findIndex(s => s.folder_name === student.folder_name);
            if (sIdx !== -1) {
                Object.keys(studentPending).forEach(qKey => {
                    if (updated[sIdx].questions[qKey]) {
                        updated[sIdx].questions[qKey].score = studentPending[qKey].score;
                        updated[sIdx].questions[qKey].comment = studentPending[qKey].comment;
                    }
                });
            }
            return updated;
        });

        setPendingChanges(prev => {
            const newPending = { ...prev };
            delete newPending[student.folder_name];
            return newPending;
        });

        toast.success(t.allGradesSaved);
    } catch {
        toast.error('Error saving all grades');
    } finally {
        setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    const student = students[currentIndex];
    if (!student) return;
    const qKey = `q${currentQ}`;
    
    setPendingChanges(prev => {
        const newPending = { ...prev };
        if (newPending[student.folder_name]) {
            delete newPending[student.folder_name][qKey];
            if (Object.keys(newPending[student.folder_name]).length === 0) {
                delete newPending[student.folder_name];
            }
        }
        return newPending;
    });

    const original = student.questions[qKey];
    setEditScore(original.score);
    setEditComment(original.comment);
    toast.success(t.changesDiscarded);
  };

  return {
    code,
    tempCode,
    setTempCode,
    editScore,
    editComment,
    saving,
    handleEditChange,
    handleSave,
    handleSaveAll,
    handleDiscardChanges
  };
};
