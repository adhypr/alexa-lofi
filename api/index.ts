import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SkillBuilders,
  RequestHandler,
  ErrorHandler,
  getRequestType,
  getIntentName,
} from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

// URL Direct Stream REYFM #LOFI (320 kbps MP3)
const STREAM_URL = 'https://listen.reyfm.de/lofi_320kbps.mp3';
const STREAM_TOKEN = 'reyfm-lofi-stream';

/**
 * 1. LaunchRequestHandler
 * Dipanggil saat user membuka skill: "Alexa, open <skill-name>"
 */
const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput): Response {
    const speechText = 'Memutar REYFM Lofi Chill Beats untuk kamu.';
    return handlerInput.responseBuilder
      .speak(speechText)
      .addAudioPlayerPlayDirective('REPLACE_ALL', STREAM_URL, STREAM_TOKEN, 0)
      .getResponse();
  },
};

/**
 * 2. PlayIntentHandler
 * Menangani permintaan memutar musik atau resume: "Alexa, play / resume"
 */
const PlayIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      ['PlayLofiIntent', 'AMAZON.ResumeIntent', 'AMAZON.StartOverIntent'].includes(
        getIntentName(handlerInput.requestEnvelope)
      )
    );
  },
  handle(handlerInput): Response {
    return handlerInput.responseBuilder
      .addAudioPlayerPlayDirective('REPLACE_ALL', STREAM_URL, STREAM_TOKEN, 0)
      .getResponse();
  },
};

/**
 * 3. Pause & Stop Intent Handler
 * Menangani saat user meminta berhenti: "Alexa, stop / pause / cancel"
 */
const PauseAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      ['AMAZON.PauseIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent'].includes(
        getIntentName(handlerInput.requestEnvelope)
      )
    );
  },
  handle(handlerInput): Response {
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .getResponse();
  },
};

/**
 * 4. HelpIntentHandler
 * Menangani saat user meminta bantuan: "Alexa, help"
 */
const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput): Response {
    const speechText =
      'Kamu bisa meminta aku memutar musik lo-fi dengan mengatakan: Alexa, putar lofi. Untuk berhenti, katakan: Alexa, stop.';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

/**
 * 5. AudioPlayer Event Handlers
 * Menangani lifecycle event dari AudioPlayer (Started, Finished, Stopped, Failed, dll.)
 */
const AudioPlayerEventHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope).startsWith('AudioPlayer.');
  },
  handle(handlerInput): Response {
    const requestType = getRequestType(handlerInput.requestEnvelope);
    console.log(`AudioPlayer event received: ${requestType}`);

    // Jika terjadi error saat memutar stream di perangkat Alexa
    if (requestType === 'AudioPlayer.PlaybackFailed') {
      console.error(
        'Playback failed error:',
        JSON.stringify(handlerInput.requestEnvelope.request)
      );
    }

    // Alexa AudioPlayer event tidak boleh mengembalikan speech, cukup respon kosong
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * 6. PlaybackController Handlers
 * Menangani tombol fisik atau tombol di layar Echo Show (Play / Pause button)
 */
const PlaybackControllerHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope).startsWith(
      'PlaybackController.'
    );
  },
  handle(handlerInput): Response {
    const requestType = getRequestType(handlerInput.requestEnvelope);

    if (requestType === 'PlaybackController.PlayCommandIssued') {
      return handlerInput.responseBuilder
        .addAudioPlayerPlayDirective('REPLACE_ALL', STREAM_URL, STREAM_TOKEN, 0)
        .getResponse();
    }

    if (requestType === 'PlaybackController.PauseCommandIssued') {
      return handlerInput.responseBuilder
        .addAudioPlayerStopDirective()
        .getResponse();
    }

    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * 7. SystemExceptionHandler
 * Menangani error dari perangkat (misal System.ExceptionEncountered)
 */
const SystemExceptionHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'System.ExceptionEncountered'
    );
  },
  handle(handlerInput): Response {
    console.error(
      'System exception encountered:',
      JSON.stringify(handlerInput.requestEnvelope.request)
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * 8. SessionEndedRequestHandler
 * Saat sesi suara ditutup
 */
const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput): Response {
    console.log('Session ended.');
    return handlerInput.responseBuilder.getResponse();
  },
};

/**
 * 9. ErrorHandler
 * Menangkap error runtime yang tidak terduga
 */
const CustomErrorHandler: ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Skill Error:', error);
    const speechText = 'Maaf, terjadi kesalahan saat memproses permintaan musik kamu.';
    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};

// Inisialisasi Alexa Skill instance sekali di memori (Serverless cold-start optimization)
const skill = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PlayIntentHandler,
    PauseAndStopIntentHandler,
    HelpIntentHandler,
    PlaybackControllerHandler,
    AudioPlayerEventHandler,
    SystemExceptionHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(CustomErrorHandler)
  .create();

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Health check endpoint jika dibuka di browser
  if (req.method === 'GET') {
    return res.status(200).send('Alexa REYFM Lo-Fi Skill Service is Running.');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await skill.invoke(req.body);
    return res.status(200).json(response);
  } catch (err: unknown) {
    console.error('Error handling Alexa request:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: errorMessage });
  }
}
