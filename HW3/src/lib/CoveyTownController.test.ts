import { nanoid } from 'nanoid';
import { mock, mockDeep, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import { listeners } from 'process';
import exp from 'constants';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import { Direction, UserLocation } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';
import { BoundingBox, ServerConversationArea } from '../client/TownsServiceClient';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => {
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName).toBe(townName);
  });
  describe('addPlayer', () => {
    it('should use the coveyTownID and player ID properties when requesting a video token', async () => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
      expect(mockTwilioVideo.getTokenForTown).toBeCalledTimes(1);
      expect(mockTwilioVideo.getTokenForTown).toBeCalledWith(
        townController.coveyTownID,
        newPlayerSession.player.id,
      );
    });
  });

  describe('destorySession', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
    });
    it('should emit onConversationAreaUpdated to all of the listener', async () => {
      const newConversationArea = TestUtils.createConversationForTesting();
      const player1 = new Player('testing player 1');
      const player2 = new Player('testing player 2');
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 400,
        y: 400,
        conversationLabel: newConversationArea.label,
      };
      testingTown.addConversationArea(newConversationArea);
      expect(testingTown.conversationAreas.length).toBe(1);

      const playerOneSession = await testingTown.addPlayer(player1);
      const playerTwoSession = await testingTown.addPlayer(player2);
      expect(testingTown.players.length).toBe(2);

      testingTown.updatePlayerLocation(player1, newLocation);
      testingTown.updatePlayerLocation(player2, newLocation);
      expect(newConversationArea.occupantsByID.length).toBe(2);

      testingTown.destroySession(playerOneSession);
      mockListeners.forEach(listener =>
        expect(listener.onConversationAreaUpdated).toBeCalledWith(newConversationArea),
      );
      expect(newConversationArea.occupantsByID.length).toBe(1);
      testingTown.destroySession(playerTwoSession);
      mockListeners.forEach(listener =>
        expect(listener.onConversationAreaDestroyed).toBeCalledWith(newConversationArea),
      );
      expect(newConversationArea.occupantsByID.length).toBe(0);
    });
  });

  describe('updatePlayerLocation', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    let player1: Player;
    let player2: Player;
    let firstConversationArea: ServerConversationArea;
    let secondConversationArea: ServerConversationArea;
    let firstConversationAreaLocation: UserLocation;
    let secondConversationAreaLocation: UserLocation;
    let emptyConversationAreaLocation: UserLocation;
    let insideFirstConversationAreaLocation: UserLocation;
    beforeEach(async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      const newBoundBox: BoundingBox = {
        x: 1000,
        y: 1000,
        width: 10,
        height: 10,
      };
      const secondAreaInfo = {
        conversationLabel: 'testing label',
        conversationTopic: 'testing topic',
        boundingBox: newBoundBox,
      };
      firstConversationArea = TestUtils.createConversationForTesting();
      secondConversationArea = TestUtils.createConversationForTesting(secondAreaInfo);
      expect(secondConversationArea.boundingBox).toBe(newBoundBox);
      expect(secondConversationArea.label).toBe(secondAreaInfo.conversationLabel);
      expect(secondConversationArea.topic).toBe(secondAreaInfo.conversationTopic);
      expect(secondConversationArea.occupantsByID.length).toBe(0);
      mockListeners.forEach(mockReset);
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      player1 = new Player('testing player 1');
      player2 = new Player('testing player 2');
      expect(player1.userName).toBe('testing player 1');
      expect(player2.userName).toBe('testing player 2');
      await testingTown.addPlayer(player1);
      mockListeners.forEach(listener => {
        expect(listener.onPlayerJoined).toBeCalledWith(player1);
        expect(listener.onPlayerJoined).toBeCalledTimes(1);
        expect(listener.onPlayerMoved).not.toBeCalled();
      });
      expect(testingTown.players.length).toBe(1);
      expect(testingTown.players[0]).toBe(player1);

      mockListeners.forEach(mockReset);
      await testingTown.addPlayer(player2);
      mockListeners.forEach(listener => {
        expect(listener.onPlayerJoined).toBeCalledWith(player2);
        expect(listener.onPlayerJoined).toBeCalledTimes(1);
        expect(listener.onPlayerMoved).not.toBeCalled();
      });
      expect(testingTown.players.length).toBe(2);
      expect(testingTown.players[1]).toBe(player2);
      mockListeners.forEach(mockReset);

      testingTown.addConversationArea(firstConversationArea);
      mockListeners.forEach(listener => {
        expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        expect(listener.onConversationAreaUpdated).toBeCalledWith(firstConversationArea);
        expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
      });
      expect(testingTown.conversationAreas.length).toBe(1);
      expect(testingTown.conversationAreas[0]).toBe(firstConversationArea);

      mockListeners.forEach(mockReset);
      testingTown.addConversationArea(secondConversationArea);
      expect(testingTown.conversationAreas.length).toBe(2);
      expect(testingTown.conversationAreas[1]).toBe(secondConversationArea);
      mockListeners.forEach(listener => {
        expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
        expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
      });

      mockListeners.forEach(mockReset);
      firstConversationAreaLocation = {
        moving: false,
        rotation: 'front',
        x: 400,
        y: 400,
        conversationLabel: firstConversationArea.label,
      };
      secondConversationAreaLocation = {
        moving: false,
        rotation: 'front',
        x: newBoundBox.x,
        y: newBoundBox.y,
        conversationLabel: secondConversationArea.label,
      };
      emptyConversationAreaLocation = {
        moving: false,
        rotation: 'front',
        x: 2000,
        y: 2000,
        conversationLabel: '',
      };
      insideFirstConversationAreaLocation = {
        moving: false,
        rotation: 'front',
        x: 400,
        y: 401,
        conversationLabel: firstConversationArea.label,
      };
    });
    describe('updatePlayerLocation when players move and calls on playerMoved', () => {
      beforeEach(() => {
        testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
        expect(player1.location).toBe(emptyConversationAreaLocation);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(secondConversationArea.occupantsByID.length).toBe(0);
        expect(testingTown.conversationAreas.length).toBe(2);
        mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player1));
        testingTown.updatePlayerLocation(player2, emptyConversationAreaLocation);
        expect(player2.location).toBe(emptyConversationAreaLocation);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(secondConversationArea.occupantsByID.length).toBe(0);
        expect(testingTown.conversationAreas.length).toBe(2);
        mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player2));
        mockListeners.forEach(mockReset);
      });
      it('should change the location of the player', async () => {
        expect(player1.location).not.toBe(firstConversationAreaLocation);
        expect(player1.isWithin(firstConversationArea)).toBe(false);
        expect(player1.isWithin(secondConversationArea)).toBe(false);
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);
        expect(player1.isWithin(firstConversationArea)).toBe(true);
        expect(player1.isWithin(secondConversationArea)).toBe(false);
        expect(player1.location).toBe(firstConversationAreaLocation);
        mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player1));
        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
        expect(player1.location).toBe(secondConversationAreaLocation);
        mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player1));
      });
      it('should emit on player moved', async () => {
        testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
        expect(player1.location).toBe(emptyConversationAreaLocation);
        expect(testingTown.players[0].location).toBe(emptyConversationAreaLocation);
        expect(testingTown.players.length).toBe(2);
        expect(player1.activeConversationArea).toBe(undefined);
        expect(testingTown.players[0].activeConversationArea).toBe(undefined);
        mockListeners.forEach(listener => {
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toBeCalledTimes(1);
          expect(listener.onConversationAreaUpdated).not.toBeCalled();
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
      });

      it('should emit on updateConversationArea when a player enters a area', async () => {
        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(0);
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
        });

        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player1.isWithin(secondConversationArea)).toBe(true);
        expect(testingTown.players[0].activeConversationArea).toBe(secondConversationArea);
        expect(testingTown.players[0].isWithin(secondConversationArea)).toBe(true);
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
      });
      it('should emit on destroy when last player leaves a area', async () => {
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);
        testingTown.updatePlayerLocation(player1, insideFirstConversationAreaLocation);
        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
        expect(player1.location).toBe(emptyConversationAreaLocation);
        expect(testingTown.players[0].location).toBe(emptyConversationAreaLocation);
        expect(player1.activeConversationArea).toBe(undefined);
        expect(player1.isWithin(firstConversationArea)).toBe(false);
        expect(testingTown.players[0].activeConversationArea).toBe(undefined);
        expect(testingTown.players[0].isWithin(firstConversationArea)).toBe(false);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaDestroyed).toBeCalledWith(firstConversationArea);
          expect(listener.onConversationAreaUpdated).not.toBeCalled();
          expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
        });
      });
      it('should not emit on updateConversationArea when a player moves in a area', async () => {
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player1, insideFirstConversationAreaLocation);
        expect(player1.location).toBe(insideFirstConversationAreaLocation);
        expect(testingTown.players[0].location).toBe(insideFirstConversationAreaLocation);
        expect(player1.activeConversationArea).toBe(firstConversationArea);
        expect(player1.isWithin(firstConversationArea)).toBe(true);
        expect(testingTown.players[0].activeConversationArea).toBe(firstConversationArea);
        expect(testingTown.players[0].isWithin(firstConversationArea)).toBe(true);
        expect(firstConversationArea.occupantsByID.length).toBe(1);
        expect(firstConversationArea.occupantsByID[0]).toBe(player1.id);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).not.toBeCalled();
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
        });
      });
      describe('updatePlayerLocation when multiple players enter and leaves a conversationArea', () => {
        beforeEach(() => {
          mockListeners.forEach(mockReset);
          testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
          mockListeners.forEach(listener => {
            expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(0);
            expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
            expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
            expect(listener.onPlayerMoved).toBeCalledWith(player1);
            expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
          });

          expect(player1.activeConversationArea).toBe(secondConversationArea);
          expect(player1.isWithin(secondConversationArea)).toBe(true);
          expect(testingTown.players[0].activeConversationArea).toBe(secondConversationArea);
          expect(testingTown.players[0].isWithin(secondConversationArea)).toBe(true);
          expect(secondConversationArea.occupantsByID.length).toBe(1);
          expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
          expect(firstConversationArea.occupantsByID.length).toBe(0);
        });
        describe('should add a second player', () => {
          beforeEach(() => {
            mockListeners.forEach(mockReset);
            testingTown.updatePlayerLocation(player2, secondConversationAreaLocation);
            mockListeners.forEach(listener => {
              expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(0);
              expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
              expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
              expect(listener.onPlayerMoved).toBeCalledWith(player2);
              expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
            });
            expect(player1.activeConversationArea).toBe(secondConversationArea);
            expect(player2.activeConversationArea).toBe(secondConversationArea);
            expect(player2.isWithin(secondConversationArea)).toBe(true);
            expect(testingTown.players[1].activeConversationArea).toBe(secondConversationArea);
            expect(testingTown.players[1].isWithin(secondConversationArea)).toBe(true);
            expect(secondConversationArea.occupantsByID.length).toBe(2);
            expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
            expect(firstConversationArea.occupantsByID.length).toBe(0);
          });
          describe('should emit onConversationUpdate when one player leaves and no onConversationDestory', () => {
            beforeEach(() => {
              mockListeners.forEach(mockReset);
              testingTown.updatePlayerLocation(player2, emptyConversationAreaLocation);
              mockListeners.forEach(listener => {
                expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(0);
                expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
                expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
                expect(listener.onPlayerMoved).toBeCalledWith(player2);
                expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
              });
              expect(player1.activeConversationArea).toBe(secondConversationArea);
              expect(player2.activeConversationArea).toBe(undefined);
              expect(player2.isWithin(secondConversationArea)).toBe(false);
              expect(testingTown.players[1].activeConversationArea).toBe(undefined);
              expect(testingTown.players[1].isWithin(secondConversationArea)).toBe(false);
              expect(testingTown.conversationAreas.length).toBe(2);
              expect(secondConversationArea.occupantsByID.length).toBe(1);
              expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
              expect(firstConversationArea.occupantsByID.length).toBe(0);
            });
            it('should emit onConversationDestroy and no onConversationUpdate when last player leaves', () => {
              mockListeners.forEach(mockReset);
              testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
              mockListeners.forEach(listener => {
                expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
                expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(0);
                expect(listener.onPlayerMoved).toBeCalledWith(player1);
                expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
              });
              expect(player1.activeConversationArea).toBe(undefined);
              expect(player2.activeConversationArea).toBe(undefined);
              expect(player1.isWithin(secondConversationArea)).toBe(false);
              expect(testingTown.players[0].activeConversationArea).toBe(undefined);
              expect(testingTown.players[0].isWithin(secondConversationArea)).toBe(false);
              expect(testingTown.conversationAreas.length).toBe(1);
              expect(secondConversationArea.occupantsByID.length).toBe(0);
              expect(firstConversationArea.occupantsByID.length).toBe(0);
            });
          });
        });
      });
      it('should remove player from conversation area if player moved to another conversationArea', async () => {
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);
        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).toBeCalledWith(firstConversationArea);
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toHaveBeenCalledTimes(1);
        });
        expect(player1.location).toBe(secondConversationAreaLocation);
        expect(testingTown.players[0].location).toBe(secondConversationAreaLocation);
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player1.isWithin(secondConversationArea)).toBe(true);
        expect(testingTown.players[0].activeConversationArea).toBe(secondConversationArea);
        expect(testingTown.players[0].isWithin(secondConversationArea)).toBe(true);
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(testingTown.conversationAreas.length).toBe(1);
        expect(testingTown.conversationAreas[0]).toBe(secondConversationArea);
      });

      it('should remove players from conversation area if two player left', async () => {
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player2, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player2);
          expect(listener.onPlayerMoved).toBeCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
        expect(secondConversationArea.occupantsByID.length).toBe(2);
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player2.activeConversationArea).toBe(secondConversationArea);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(secondConversationArea.occupantsByID[1]).toBe(player2.id);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
        expect(player1.activeConversationArea).toBe(undefined);
        expect(player2.activeConversationArea).toBe(secondConversationArea);
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(secondConversationArea.occupantsByID[0]).toBe(player2.id);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player2, emptyConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).not.toBeCalled();
          expect(listener.onConversationAreaDestroyed).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
        });
        expect(player1.activeConversationArea).toBe(undefined);
        expect(player2.activeConversationArea).toBe(undefined);
        expect(secondConversationArea.occupantsByID.length).toBe(0);
        expect(testingTown.conversationAreas.length).toBe(1);
        expect(testingTown.conversationAreas[0]).toBe(firstConversationArea);
      });
      it('should emit the correct conversationArea for onConversationAreaDestroyed', async () => {
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toBeCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player2, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player2);
          expect(listener.onPlayerMoved).toBeCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(secondConversationArea.occupantsByID.length).toBe(2);
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player2.activeConversationArea).toBe(secondConversationArea);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(secondConversationArea.occupantsByID[1]).toBe(player2.id);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player1, emptyConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onConversationAreaDestroyed).not.toBeCalled();
        });
        expect(player1.activeConversationArea).toBe(undefined);
        expect(player2.activeConversationArea).toBe(secondConversationArea);
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(secondConversationArea.occupantsByID[0]).toBe(player2.id);

        mockListeners.forEach(mockReset);
        testingTown.updatePlayerLocation(player2, emptyConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).not.toBeCalled();
          expect(listener.onConversationAreaDestroyed).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
        });
        expect(player1.activeConversationArea).toBe(undefined);
        expect(player2.activeConversationArea).toBe(undefined);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(testingTown.conversationAreas.length).toBe(1);
        expect(testingTown.conversationAreas[0]).toBe(firstConversationArea);
      });

      it('should be able to updatePlayerLocation between two conversation area', async () => {
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(firstConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
          expect(listener.onPlayerMoved).toBeCalledWith(player1);
          expect(listener.onPlayerMoved).toBeCalledTimes(1);
        });
        expect(player1.activeConversationArea).toBe(firstConversationArea);
        expect(firstConversationArea.occupantsByID.length).toBe(1);
        expect(firstConversationArea.occupantsByID[0]).toBe(player1.id);

        testingTown.updatePlayerLocation(player2, firstConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(firstConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(2);
          expect(listener.onPlayerMoved).toBeCalledWith(player2);
          expect(listener.onPlayerMoved).toBeCalledTimes(2);
        });
        expect(firstConversationArea.occupantsByID.length).toBe(2);
        expect(player1.activeConversationArea).toBe(firstConversationArea);
        expect(player2.activeConversationArea).toBe(firstConversationArea);
        expect(firstConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(firstConversationArea.occupantsByID[1]).toBe(player2.id);

        testingTown.updatePlayerLocation(player1, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(firstConversationArea);
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(4);
        });
        expect(secondConversationArea.occupantsByID.length).toBe(1);
        expect(secondConversationArea.occupantsByID[0]).toBe(player1.id);
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player2.activeConversationArea).toBe(firstConversationArea);
        testingTown.updatePlayerLocation(player2, secondConversationAreaLocation);
        mockListeners.forEach(listener => {
          expect(listener.onConversationAreaUpdated).toBeCalledWith(secondConversationArea);
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(5);
          expect(listener.onConversationAreaDestroyed).toBeCalledWith(firstConversationArea);
          expect(listener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
        });
        expect(player1.activeConversationArea).toBe(secondConversationArea);
        expect(player2.activeConversationArea).toBe(secondConversationArea);
        expect(firstConversationArea.occupantsByID.length).toBe(0);
        expect(testingTown.conversationAreas.length).toBe(1);
      });
    });
  });

  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toBeCalledWith(player),
      );
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));
    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());
    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();
    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });
  });

  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);
      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(
              testingTown.coveyTownID,
              session.sessionToken,
              mockSocket,
            );
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }
        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'playerMovement',
        );
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    let player1: Player;
    let player2: Player;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    let firstConversationArea: ServerConversationArea;
    let firstConversationAreaLocation: UserLocation;
    beforeEach(async () => {
      firstConversationAreaLocation = {
        moving: false,
        rotation: 'front',
        x: 1000,
        y: 1000,
        conversationLabel: '',
      };
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(listener => {
        testingTown.addTownListener(listener);
      });
      const newBoundBox: BoundingBox = {
        x: 1000,
        y: 1000,
        width: 10,
        height: 10,
      };
      const secondAreaInfo = {
        conversationLabel: 'testing label',
        conversationTopic: 'testing topic',
        boundingBox: newBoundBox,
      };
      firstConversationArea = TestUtils.createConversationForTesting(secondAreaInfo);
    });
    describe('should be able to automatically add players if they are in the conversationArea', () => {
      beforeEach(async () => {
        player1 = new Player('testing player 1');
        player2 = new Player('testing player 2');
        expect(player1.userName).toBe('testing player 1');
        expect(player2.userName).toBe('testing player 2');
        await testingTown.addPlayer(player1);
        await testingTown.addPlayer(player2);
        testingTown.updatePlayerLocation(player1, firstConversationAreaLocation);
        testingTown.updatePlayerLocation(player2, firstConversationAreaLocation);
        mockListeners.forEach(mockReset);
      });
      describe('it should not add the empty topic', () => {
        beforeEach(() => {
          const newBoundBox: BoundingBox = {
            x: 1000,
            y: 1000,
            width: 10,
            height: 10,
          };

          const emptyTopicConversationArea: ServerConversationArea = {
            boundingBox: newBoundBox,
            label: 'testing labels',
            occupantsByID: [],
            topic: '',
          };
          expect(testingTown.addConversationArea(emptyTopicConversationArea)).toBe(false);
          mockListeners.forEach(listener => {
            expect(listener.onConversationAreaUpdated).not.toBeCalled();
          });
          mockListeners.forEach(mockReset);
        });
        describe('it should add a correct converstaionArea', () => {
          let correctTopicConversationArea: ServerConversationArea;
          beforeEach(() => {
            const newBoundBox: BoundingBox = {
              x: 400,
              y: 400,
              width: 10,
              height: 10,
            };
            correctTopicConversationArea = TestUtils.createConversationForTesting();
            expect(correctTopicConversationArea.boundingBox).toStrictEqual(newBoundBox);
            expect(testingTown.addConversationArea(correctTopicConversationArea)).toBe(true);
            expect(testingTown.conversationAreas.length).toBe(1);
            expect(testingTown.conversationAreas[0]).toBe(correctTopicConversationArea);
            expect(testingTown.conversationAreas[0].label).toBe(correctTopicConversationArea.label);
            expect(testingTown.conversationAreas[0].topic).toBe(correctTopicConversationArea.topic);
            expect(testingTown.conversationAreas[0].occupantsByID).toStrictEqual([]);
            mockListeners.forEach(listener => {
              expect(listener.onConversationAreaUpdated).toBeCalledWith(
                correctTopicConversationArea,
              );
              expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
            });

            mockListeners.forEach(mockReset);
          });
          describe('should add another correct conversationArea', () => {
            beforeEach(() => {
              expect(testingTown.addConversationArea(firstConversationArea)).toBe(true);
              expect(testingTown.conversationAreas.length).toBe(2);
              expect(testingTown.conversationAreas[0]).toBe(correctTopicConversationArea);
              expect(testingTown.conversationAreas[1]).toBe(firstConversationArea);
              mockListeners.forEach(listener => {
                expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
                expect(listener.onConversationAreaUpdated).toBeCalledWith(firstConversationArea);
              });
              mockListeners.forEach(mockReset);
            });
            it('should add players that is in this conversationArea', () => {
              expect(firstConversationArea.occupantsByID.length).toBe(2);
              expect(player1.activeConversationArea).toBe(firstConversationArea);
              expect(player2.activeConversationArea).toBe(firstConversationArea);
            });
            describe('should add players that is in a created conversationArea', () => {
              it('should add players in created conversationArea', () => {
                const player = new Player('testing player');
                testingTown.addPlayer(player);
                const dir: Direction = 'front';
                const firstConversationAreaLocations = [
                  {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 600,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 604,
                    y: 604,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 596,
                    y: 596,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 602,
                    y: 596,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 596,
                    y: 602,
                    conversationLabel: '',
                  },
                ];
                let newConversationArea: ServerConversationArea;
                firstConversationAreaLocations.forEach(element => {
                  mockListeners.forEach(mockReset);
                  testingTown.updatePlayerLocation(player, element);
                  const newBoundBox: BoundingBox = {
                    x: 600,
                    y: 600,
                    width: 10,
                    height: 10,
                  };
                  const secondAreaInfo = {
                    conversationLabel: nanoid(),
                    conversationTopic: nanoid(),
                    boundingBox: newBoundBox,
                  };
                  newConversationArea = TestUtils.createConversationForTesting(secondAreaInfo);
                  expect(newConversationArea.occupantsByID.length).toBe(0);
                  expect(testingTown.addConversationArea(newConversationArea)).toBe(true);
                  expect(testingTown.conversationAreas.length).toBe(3);
                  expect(testingTown.conversationAreas[0]).toBe(correctTopicConversationArea);
                  expect(testingTown.conversationAreas[1]).toBe(firstConversationArea);
                  expect(testingTown.conversationAreas[2]).toBe(newConversationArea);
                  expect(newConversationArea.occupantsByID.length).toBe(1);
                  expect(player.activeConversationArea).toBe(newConversationArea);
                  mockListeners.forEach(listener => {
                    expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
                    expect(listener.onConversationAreaUpdated).toBeCalledWith(newConversationArea);
                  });
                  testingTown.updatePlayerLocation(player, firstConversationAreaLocation);
                  expect(testingTown.conversationAreas.length).toBe(2);
                });
              });
            });
            describe('should not add players that is not in a created conversationArea', () => {
              it('should not add players in created conversationArea', () => {
                const player = new Player('testing player');
                testingTown.addPlayer(player);
                const dir: Direction = 'front';
                const firstConversationAreaLocations = [
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 605,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 600,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 605,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 10000,
                    y: 610,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 609,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 604,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 604,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 595,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 595,
                    y: 600,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 595,
                    y: 605,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 605,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 700,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 1000,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 200,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 200,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 200,
                    y: 595,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 200,
                    conversationLabel: '',
                  },
                  {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 1000,
                    conversationLabel: '',
                  },
                ];
                firstConversationAreaLocations.forEach(element => {
                  mockListeners.forEach(mockReset);
                  testingTown.updatePlayerLocation(player, element);
                  const newBoundBox: BoundingBox = {
                    x: 600,
                    y: 600,
                    width: 10,
                    height: 10,
                  };
                  const label = nanoid();
                  const secondAreaInfo = {
                    conversationLabel: label,
                    conversationTopic: nanoid(),
                    boundingBox: newBoundBox,
                  };
                  const newAreaLocation = {
                    moving: false,
                    rotation: dir,
                    x: 600,
                    y: 600,
                    conversationLabel: label,
                  };

                  const newConversationArea =
                    TestUtils.createConversationForTesting(secondAreaInfo);
                  expect(newConversationArea.occupantsByID.length).toBe(0);
                  expect(testingTown.addConversationArea(newConversationArea)).toBe(true);
                  expect(testingTown.conversationAreas.length).toBe(3);
                  expect(testingTown.conversationAreas[0]).toBe(correctTopicConversationArea);
                  expect(testingTown.conversationAreas[1]).toBe(firstConversationArea);
                  expect(testingTown.conversationAreas[2]).toBe(newConversationArea);
                  expect(newConversationArea.occupantsByID.length).toBe(0);
                  expect(player.activeConversationArea).toBe(undefined);
                  mockListeners.forEach(listener => {
                    expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
                    expect(listener.onConversationAreaUpdated).toBeCalledWith(newConversationArea);
                  });
                  testingTown.updatePlayerLocation(player, newAreaLocation);
                  testingTown.updatePlayerLocation(player, firstConversationAreaLocation);
                  expect(testingTown.conversationAreas.length).toBe(2);
                });
              });
            });
            it('should not add another conversationArea with the same label', () => {
              const newBoundBox: BoundingBox = {
                x: 10,
                y: 10,
                width: 10,
                height: 10,
              };
              const sameLabelConversationArea: ServerConversationArea = {
                boundingBox: newBoundBox,
                label: 'testing label',
                occupantsByID: [],
                topic: 'testing topic',
              };
              expect(testingTown.addConversationArea(sameLabelConversationArea)).toBe(false);
              expect(testingTown.conversationAreas.length).toBe(2);
              expect(testingTown.conversationAreas[0]).toBe(correctTopicConversationArea);
              mockListeners.forEach(listener => {
                expect(listener.onConversationAreaUpdated).not.toBeCalled();
              });
              mockListeners.forEach(mockReset);
            });
            it('should add not overLappingBoxes', () => {
              const boundBoxes = [
                {
                  x: 410,
                  y: 410,
                  width: 10,
                  height: 10,
                },
                {
                  x: 390,
                  y: 390,
                  width: 10,
                  height: 10,
                },
                {
                  x: 400,
                  y: 410,
                  width: 10,
                  height: 10,
                },
                {
                  x: 410,
                  y: 400,
                  width: 10,
                  height: 10,
                },
                {
                  x: 390,
                  y: 400,
                  width: 10,
                  height: 10,
                },
                {
                  x: 390,
                  y: 410,
                  width: 10,
                  height: 10,
                },
                {
                  x: 400,
                  y: 390,
                  width: 10,
                  height: 10,
                },
                {
                  x: 410,
                  y: 390,
                  width: 10,
                  height: 10,
                },
              ];
              boundBoxes.forEach((element, index) => {
                const secondAreaInfo = {
                  boundingBox: element,
                };
                const notOverLappingBoxes: ServerConversationArea =
                  TestUtils.createConversationForTesting(secondAreaInfo);
                expect(testingTown.addConversationArea(notOverLappingBoxes)).toBe(true);
                expect(testingTown.conversationAreas.length).toBe(2 + index + 1);
                mockListeners.forEach(listener => {
                  expect(listener.onConversationAreaUpdated).toBeCalledWith(notOverLappingBoxes);
                  expect(listener.onConversationAreaUpdated).toBeCalledTimes(1);
                });
                mockListeners.forEach(mockReset);
              });
            });
            it('should add not overLappingBoxes', () => {
              const boundBoxes = [
                {
                  x: 400,
                  y: 400,
                  width: 10,
                  height: 10,
                },
                {
                  x: 401,
                  y: 401,
                  width: 1,
                  height: 1,
                },
                {
                  x: 500,
                  y: 500,
                  width: 400,
                  height: 400,
                },
                {
                  x: 390,
                  y: 400,
                  width: 11,
                  height: 10,
                },
                {
                  x: 410,
                  y: 390,
                  width: 11,
                  height: 11,
                },
              ];
              boundBoxes.forEach(element => {
                const secondAreaInfo = {
                  boundingBox: element,
                };
                const notOverLappingBoxes: ServerConversationArea =
                  TestUtils.createConversationForTesting(secondAreaInfo);
                expect(testingTown.addConversationArea(notOverLappingBoxes)).toBe(false);
                expect(testingTown.conversationAreas.length).toBe(2);
                mockListeners.forEach(listener => {
                  expect(listener.onConversationAreaUpdated).not.toBeCalled();
                });
                mockListeners.forEach(mockReset);
              });
            });
          });
        });
      });
    });
  });

  describe('updatePlayerLocation', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it("should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player's x,y location", async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(newConversationArea.boundingBox);

      const areas = testingTown.conversationAreas;
      expect(areas[0].occupantsByID.length).toBe(1);
      expect(areas[0].occupantsByID[0]).toBe(player.id);
    });
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
