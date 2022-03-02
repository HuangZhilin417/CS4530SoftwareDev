import * as client from './client';
import { importGrades } from './examples';
describe('Transcript Manager Service', () => {
  test('Create student should return an ID', async () => {
    const createdStudent = await client.addStudent('Avery');
    expect(createdStudent.studentID).toBeGreaterThan(4);
  });
  
  test('Import grades should create one record for each of the students in the import', async () => {
    const importResult = await importGrades([
      {
        studentName: 'Avery',
        grades: [
          { course: 'Software Engineering', grade: 100 },
          { course: 'Chemistry', grade: 70 },
        ],
      },
      {
        studentName: 'Ripley',
        grades: [
          { course: 'Underwater Basket Weaving', grade: 100 },
          { course: 'Kayaking', grade: 90 },
        ],
      },
    ]);
    expect(importResult).toBeDefined();
  });
  test('getTranscript should get the student transcipt and add grade should create a transcript', async () => {
    const studentId = await client.addStudent('Avery');
    const oldTranscipt = await client.getTranscript(studentId.studentID);
    await client.deleteStudent(studentId.studentID)
    const importResult = await importGrades([
      {
        studentName: 'Avery',
        grades: [
          { course: 'Software Engineering', grade: 100 },
          { course: 'Chemistry', grade: 70 },
        ],
      },
      {
        studentName: 'Ripley',
        grades: [
          { course: 'Underwater Basket Weaving', grade: 100 },
          { course: 'Kayaking', grade: 90 },
        ],
      },
    ]);
    const allStudent = await client.getStudentIDs('Avery')
    expect(allStudent).toBeDefined();
    const newTranscipt = await client.getTranscript(allStudent[0]);
    expect(newTranscipt).toBeDefined();
  });
});
