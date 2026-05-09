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
    
    // Update local students state temporarily to reflect "unreviewed" while editing a reviewed question
    if (isDirty && original.reviewed) {
        setStudents(prev => {
            const updated = [...prev];
            const sIdx = updated.findIndex(s => s.folder_name === student.folder_name);
            if (sIdx !== -1 && updated[sIdx].questions[qKey]) {
                updated[sIdx].questions[qKey].reviewed = false;
                // If it was the last thing making the student reviewed, update student level too
                updated[sIdx].reviewed = false;
            }
            return updated;
        });
    }

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
            // If we revert to original, restore original reviewed status if it was reviewed
            if (original.reviewed) {
                setStudents(prev => {
                    const updated = [...prev];
                    const sIdx = updated.findIndex(s => s.folder_name === student.folder_name);
                    if (sIdx !== -1 && updated[sIdx].questions[qKey]) {
                        updated[sIdx].questions[qKey].reviewed = true;
                        // Recalculate student reviewed status
                        const qs = Object.values(updated[sIdx].questions);
                        updated[sIdx].reviewed = qs.filter(q => q.path).every(q => q.reviewed);
                    }
                    return updated;
                });
            }
        }
        return newPending;
    });
  };

  const handleSave = async (studentIdx = currentIndex, questionNum = currentQ, reviewed = true) => {
    const student = students[studentIdx];
    if (!student) return;

    setSaving(true);
    const qKey = `q${questionNum}`;
    const pending = pendingChanges[student.folder_name]?.[qKey];
    
    const original = student.questions[qKey];
    const scoreToSave = (original && original.path) ? (pending ? pending.score : editScore) : 0;
    const commentToSave = pending ? pending.comment : editComment;

    try {
      const res = await api.updateGrade({
        turma: student.turma,
        studentId: student.folder_name,
        questionNum: questionNum,
        score: scoreToSave,
        comment: commentToSave,
        reviewed: reviewed
      });
      
      setStudents(prev => {
        const updated = [...prev];
        const targetStudent = updated[studentIdx];
        if (targetStudent && targetStudent.questions[qKey]) {
            targetStudent.questions[qKey].score = scoreToSave;
            targetStudent.questions[qKey].comment = commentToSave;
            targetStudent.questions[qKey].reviewed = reviewed;
            targetStudent.reviewed = res.data.studentReviewed;
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

      toast.success(reviewed ? t.gradeSavedAndReviewed || 'Grade saved and question reviewed' : t.gradeSaved);
    } catch {
      toast.error('Error saving grade');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleQuestionReviewed = async (studentIdx = currentIndex, questionNum = currentQ, status: boolean) => {
    const student = students[studentIdx];
    if (!student) return;

    const qKey = `q${questionNum}`;
    const q = student.questions[qKey];
    if (!q) return;

    try {
      const res = await api.updateGrade({
        turma: student.turma,
        studentId: student.folder_name,
        questionNum: questionNum,
        score: q.score,
        comment: q.comment,
        reviewed: status
      });
      
      setStudents(prev => {
        const updated = [...prev];
        const targetStudent = updated[studentIdx];
        if (targetStudent && targetStudent.questions[qKey]) {
            targetStudent.questions[qKey].reviewed = status;
            targetStudent.reviewed = res.data.studentReviewed;
        }
        return updated;
      });
      toast.success(status ? 'Question marked as reviewed' : 'Question review reset');
    } catch {
      toast.error('Error updating question status');
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
                comment: data.comment,
                reviewed: true
            });
        });

        const results = await Promise.all(promises);
        const lastResult = results[results.length - 1];

        setStudents(prev => {
            const updated = [...prev];
            const sIdx = updated.findIndex(s => s.folder_name === student.folder_name);
            if (sIdx !== -1) {
                Object.keys(studentPending).forEach(qKey => {
                    if (updated[sIdx].questions[qKey]) {
                        updated[sIdx].questions[qKey].score = studentPending[qKey].score;
                        updated[sIdx].questions[qKey].comment = studentPending[qKey].comment;
                        updated[sIdx].questions[qKey].reviewed = true;
                    }
                });
                updated[sIdx].reviewed = lastResult.data.studentReviewed;
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
    const original = student.questions[qKey];
    
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

    if (original) {
      setEditScore(original.score);
      setEditComment(original.comment);
      
      // Restore reviewed status if it was original
      if (original.reviewed) {
        setStudents(prev => {
            const updated = [...prev];
            const sIdx = updated.findIndex(s => s.folder_name === student.folder_name);
            if (sIdx !== -1 && updated[sIdx].questions[qKey]) {
                updated[sIdx].questions[qKey].reviewed = true;
                const qs = Object.values(updated[sIdx].questions);
                updated[sIdx].reviewed = qs.filter(q => q.path).every(q => q.reviewed);
            }
            return updated;
        });
      }
    }
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
    handleToggleQuestionReviewed,
    handleDiscardChanges
  };
};
