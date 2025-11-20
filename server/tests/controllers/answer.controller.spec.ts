jest.mock('../../services/notificationFanout.service', () => ({
  __esModule: true,
  notifyOnNewQuestion: jest.fn().mockResolvedValue(undefined),
  notifyOnNewAnswer: jest.fn().mockResolvedValue(undefined),
}));

import { notifyOnNewAnswer } from '../../services/notificationFanout.service';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { ObjectId } from 'mongodb';
import { app } from '../../app';
import * as answerUtil from '../../services/answer.service';
import * as databaseUtil from '../../utils/database.util';

const saveAnswerSpy = jest.spyOn(answerUtil, 'saveAnswer');
const addAnswerToQuestionSpy = jest.spyOn(answerUtil, 'addAnswerToQuestion');
const popDocSpy = jest.spyOn(databaseUtil, 'populateDocument');

describe('POST /addAnswer', () => {
  it('should add a new answer to the question', async () => {
    const validQid = new mongoose.Types.ObjectId().toString();
    const validAid = new mongoose.Types.ObjectId();

    const mockReqBody = {
      qid: validQid,
      ans: {
        text: 'This is a test answer',
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    // Saved answer from saveAnswer
    const mockAnswer = {
      _id: validAid,
      text: 'This is a test answer',
      ansBy: '65e9b716ff0e892116b2de01',
      ansDateTime: new Date('2024-06-03'),
      comments: [],
    };

    // Populated answer for socket + fanout
    const populatedAnswer = {
      _id: validAid,
      text: 'This is a test answer',
      ansBy: '65e9b716ff0e892116b2de01',
      ansDateTime: new Date('2024-06-03'),
      comments: [],
    };

    // Populated question for fanout
    const populatedQuestion = {
      _id: new mongoose.Types.ObjectId(),
      title: 'This is a test question',
      text: 'This is a test question',
      tags: [],
      askedBy: '65e9b716ff0e892116b2de01',
      askDateTime: new Date('2024-06-03'),
      views: [],
      upVotes: [],
      downVotes: [],
      answers: [populatedAnswer],
      comments: [],
      community: null,
    };

    saveAnswerSpy.mockResolvedValueOnce(mockAnswer);

    addAnswerToQuestionSpy.mockResolvedValueOnce({
      ...populatedQuestion,
      answers: [mockAnswer._id],
    });

    // First populateDocument call: answer
    // Second populateDocument call: question
    (popDocSpy as jest.Mock).mockResolvedValueOnce(populatedAnswer);
    (popDocSpy as jest.Mock).mockResolvedValueOnce(populatedQuestion as any);

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      _id: validAid.toString(),
      text: 'This is a test answer',
      ansBy: '65e9b716ff0e892116b2de01',
      ansDateTime: mockAnswer.ansDateTime.toISOString(),
      comments: [],
    });

    // Ensure services were called as expected
    expect(saveAnswerSpy).toHaveBeenCalledWith({
      text: mockReqBody.ans.text,
      ansBy: mockReqBody.ans.ansBy,
      ansDateTime: expect.any(String), // JSON body -> string
    });
    expect(addAnswerToQuestionSpy).toHaveBeenCalledWith(validQid, mockAnswer);
    expect(addAnswerToQuestionSpy).toHaveBeenCalledWith(validQid, mockAnswer);

    // Both populates happened
    expect(popDocSpy).toHaveBeenCalledTimes(2);

    // Fanout hook was triggered with populated models
    expect(notifyOnNewAnswer as jest.Mock).toHaveBeenCalledWith(populatedQuestion, populatedAnswer);
  });

  it('should return bad request error if answer text property is missing', async () => {
    const mockReqBody = {
      qid: '65e9b716ff0e892116b2de01',
      ans: {
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);
    const openApiError = JSON.parse(response.text);

    expect(response.status).toBe(400);
    expect(openApiError.errors[0].path).toBe('/body/ans/text');
  });

  it('should return bad request error if request body has qid property missing', async () => {
    const mockReqBody = {
      ans: {
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(400);
  });

  it('should return bad request error if answer object has ansBy property missing', async () => {
    const mockReqBody = {
      qid: 'dummyQuestionId',
      ans: {
        text: 'This is a test answer',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(400);
  });

  it('should return bad request error if answer object has ansDateTime property missing', async () => {
    const mockReqBody = {
      qid: 'dummyQuestionId',
      ans: {
        text: 'This is a test answer',
        ansBy: '65e9b716ff0e892116b2de01',
      },
    };

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(400);
  });

  it('should return bad request error if request body is missing', async () => {
    const response = await supertest(app).post('/api/answer/addAnswer');
    const openApiError = JSON.parse(response.text);

    expect(openApiError.message).toBe('Request Validation Failed');
  });

  it('should return database error in response if saveAnswer method throws an error', async () => {
    const validQid = new mongoose.Types.ObjectId().toString();
    const mockReqBody = {
      qid: validQid,
      ans: {
        text: 'This is a test answer',
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    saveAnswerSpy.mockResolvedValueOnce({ error: 'Error when saving an answer' });

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(500);
  });

  it('should return database error in response if update question method throws an error', async () => {
    const validQid = new mongoose.Types.ObjectId().toString();
    const mockReqBody = {
      qid: validQid,
      ans: {
        text: 'This is a test answer',
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    const mockAnswer = {
      _id: new ObjectId('507f191e810c19729de860ea'),
      text: 'This is a test answer',
      ansBy: '65e9b716ff0e892116b2de01',
      ansDateTime: new Date('2024-06-03'),
      comments: [],
    };

    saveAnswerSpy.mockResolvedValueOnce(mockAnswer);
    addAnswerToQuestionSpy.mockResolvedValueOnce({ error: 'Error when adding answer to question' });

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(500);
  });

  it('should return database error in response if `populateDocument` method throws an error', async () => {
    const validQid = new mongoose.Types.ObjectId();
    const mockReqBody = {
      qid: validQid,
      ans: {
        text: 'This is a test answer',
        ansBy: '65e9b716ff0e892116b2de01',
        ansDateTime: new Date('2024-06-03'),
      },
    };

    const mockAnswer = {
      _id: new ObjectId('507f191e810c19729de860ea'),
      text: 'This is a test answer',
      ansBy: '65e9b716ff0e892116b2de01',
      ansDateTime: new Date('2024-06-03'),
      comments: [],
    };

    const mockQuestion = {
      _id: validQid,
      title: 'This is a test question',
      text: 'This is a test question',
      tags: [],
      askedBy: '65e9b716ff0e892116b2de01',
      askDateTime: new Date('2024-06-03'),
      views: [],
      upVotes: [],
      downVotes: [],
      answers: [mockAnswer._id],
      comments: [],
      community: null,
    };

    saveAnswerSpy.mockResolvedValueOnce(mockAnswer);
    addAnswerToQuestionSpy.mockResolvedValueOnce(mockQuestion);
    popDocSpy.mockResolvedValueOnce({ error: 'Error when populating document' });

    const response = await supertest(app).post('/api/answer/addAnswer').send(mockReqBody);

    expect(response.status).toBe(500);
  });
});
