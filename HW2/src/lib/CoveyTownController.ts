import { customAlphabet, nanoid } from 'nanoid';
import { BoundingBox, ServerConversationArea } from '../client/TownsServiceClient';
import { UserLocation } from '../CoveyTypes';
import CoveyTownListener from '../types/CoveyTownListener';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import IVideoClient from './IVideoClient';
import TwilioVideo from './TwilioVideo';

const friendlyNanoID = customAlphabet('1234567890ABCDEF', 8);

/**
 * The CoveyTownController implements the logic for each town: managing the various events that
 * can occur (e.g. joining a town, moving, leaving a town)
 */
export default class CoveyTownController {
  get capacity(): number {
    return this._capacity;
  }

  set isPubliclyListed(value: boolean) {
    this._isPubliclyListed = value;
  }

  get isPubliclyListed(): boolean {
    return this._isPubliclyListed;
  }

  get townUpdatePassword(): string {
    return this._townUpdatePassword;
  }

  get players(): Player[] {
    return this._players;
  }

  get occupancy(): number {
    return this._listeners.length;
  }

  get friendlyName(): string {
    return this._friendlyName;
  }

  set friendlyName(value: string) {
    this._friendlyName = value;
  }

  get coveyTownID(): string {
    return this._coveyTownID;
  }

  get conversationAreas(): ServerConversationArea[] {
    return this._conversationAreas;
  }

  /** The list of players currently in the town * */
  private _players: Player[] = [];

  /** The list of valid sessions for this town * */
  private _sessions: PlayerSession[] = [];

  /** The videoClient that this CoveyTown will use to provision video resources * */
  private _videoClient: IVideoClient = TwilioVideo.getInstance();

  /** The list of CoveyTownListeners that are subscribed to events in this town * */
  private _listeners: CoveyTownListener[] = [];

  /** The list of currently active ConversationAreas in this town */
  private _conversationAreas: ServerConversationArea[] = [];

  private readonly _coveyTownID: string;

  private _friendlyName: string;

  private readonly _townUpdatePassword: string;

  private _isPubliclyListed: boolean;

  private _capacity: number;

  constructor(friendlyName: string, isPubliclyListed: boolean) {
    this._coveyTownID = process.env.DEMO_TOWN_ID === friendlyName ? friendlyName : friendlyNanoID();
    this._capacity = 50;
    this._townUpdatePassword = nanoid(24);
    this._isPubliclyListed = isPubliclyListed;
    this._friendlyName = friendlyName;
  }

  /**
   * Adds a player to this Covey Town, provisioning the necessary credentials for the
   * player, and returning them
   *
   * @param newPlayer The new player to add to the town
   */
  async addPlayer(newPlayer: Player): Promise<PlayerSession> {
    const theSession = new PlayerSession(newPlayer);
    this._sessions.push(theSession);
    this._players.push(newPlayer);

    // Create a video token for this user to join this town
    theSession.videoToken = await this._videoClient.getTokenForTown(
      this._coveyTownID,
      newPlayer.id,
    );
    // Notify other players that this player has joined
    this._listeners.forEach(listener => listener.onPlayerJoined(newPlayer));

    return theSession;
  }

  /**
   * Destroys all data related to a player in this town.
   *
   * @param session PlayerSession to destroy
   */
  destroySession(session: PlayerSession): void {
    this._players = this._players.filter(p => p.id !== session.player.id);
    this._sessions = this._sessions.filter(s => s.sessionToken !== session.sessionToken);
    if (session.player.activeConversationArea) {
      this._conversationAreas.forEach(area => {
        area.occupantsByID.forEach(id => {
          if (id === session.player.id) {
            this.removePlayerFromArea(session.player, area);
          }
        });
      });
    }
    this._listeners.forEach(listener => listener.onPlayerDisconnected(session.player));
  }

  /**
   * Updates the location of a player within the town
   *
   * If the player has changed conversation areas, this method also updates the
   * corresponding ConversationArea objects tracked by the town controller, and dispatches
   * any onConversationUpdated events as appropriate
   *
   * @param player Player to update location for
   * @param location New location for this player
   */
  updatePlayerLocation(player: Player, location: UserLocation): void {
    const newPlayer: Player = player;

    this._players.forEach((currentPlayer, index) => {
      if (player.id === currentPlayer.id) {
        const currConversationArea = currentPlayer.activeConversationArea;
        player.updateLocation(location);
        if (location.conversationLabel === undefined) {
          // If the player's location in not in a box
          if (currConversationArea !== undefined) {
            // If the old player's location is in a convoArea
            this.removePlayerFromArea(currentPlayer, currConversationArea); // Remove the player from that convoArea
          }
          // setting the new player with updated location to the current list of players
          newPlayer.activeConversationArea = undefined;
          this._players[index] = newPlayer;
        } else if (
          // If the older player were in a convoArea, then we would want to first remove the older player from the old convoArea, then add player to the new convoArea
          currConversationArea !== undefined &&
          currConversationArea.label !== location.conversationLabel
        ) {
          this.removePlayerFromArea(currentPlayer, currConversationArea); // Remove the player from that convoArea

          newPlayer.activeConversationArea = this.addPlayerToArea(player, location);
          this._players[index] = newPlayer;
        } else if (currConversationArea === undefined) {
          // If the older player were not in any convoArea, then we want to just add the player to the new area
          newPlayer.activeConversationArea = this.addPlayerToArea(player, location);
          this._players[index] = newPlayer;
        } else {
          // If we are not updating the convoArea then we just update the location
          currentPlayer.updateLocation(location);
          this._players[index] = currentPlayer;
        }
      }
    });

    this._listeners.forEach(listener => listener.onPlayerMoved(player));
  }

  // side effect: end a conversation area when it’s unoccupied
  private removePlayerFromArea(
    currentPlayer: Player,
    currConversationArea: ServerConversationArea,
  ) {
    this._conversationAreas.forEach((area, i) => {
      if (area.label === currConversationArea.label) {
        const newArea: ServerConversationArea = area;
        newArea.occupantsByID = area.occupantsByID.filter(id => id !== currentPlayer.id);
        if (newArea.occupantsByID.length === 0) {
          this._listeners.forEach(listener => {
            listener.onConversationAreaDestroyed(area);
          });
          this._conversationAreas = this._conversationAreas.filter(
            target => target.label !== area.label,
          );
        } else {
          this._conversationAreas[i] = newArea;
          this._listeners.forEach(listener => {
            listener.onConversationAreaUpdated(this._conversationAreas[i]);
          });
        }
      }
    });
  }

  private addPlayerToArea(player: Player, location: UserLocation): ServerConversationArea {
    let index = 0;
    this._conversationAreas.forEach((area, i) => {
      // updates the convoArea to include the new player and points the player's convoArea to the new convoArea
      if (area.label === location.conversationLabel) {
        const newArea: ServerConversationArea = area;
        newArea.occupantsByID.push(player.id);
        this._conversationAreas[i] = newArea;
        this._listeners.forEach(listener => {
          listener.onConversationAreaUpdated(this._conversationAreas[i]);
        });
        index = i;
      }
    });
    return this._conversationAreas[index];
  }

  /**
   * Creates a new conversation area in this town if there is not currently an active
   * conversation with the same label.
   *
   * Adds any players who are in the region defined by the conversation area to it.
   *
   * Notifies any CoveyTownListeners that the conversation has been updated
   *
   * @param _conversationArea Information describing the conversation area to create. Ignores any
   *  occupantsById that are set on the conversation area that is passed to this method.
   *
   * @returns true if the conversation is successfully created, or false if not
   */
  addConversationArea(_conversationArea: ServerConversationArea): boolean {
    function playerInBox(player: Player, box: BoundingBox): boolean {
      const x1 = box.x - box.width / 2;
      const y1 = box.y - box.height / 2;
      const x2 = box.x + box.width / 2;
      const y2 = box.y + box.height / 2;
      if (
        player.location.x > x1 &&
        player.location.x < x2 &&
        player.location.y > y1 &&
        player.location.y < y2
      )
        return true;
      return false;
    }

    if (_conversationArea.topic.length === 0) {
      return false;
    }

    let doesLabelExist = false;
    this._conversationAreas.forEach(area => {
      if (area.label === _conversationArea.label) {
        doesLabelExist = true;
      }
    });
    const doesBoxOverlap = this.checkBoxesOverlap(_conversationArea.boundingBox);

    if (doesLabelExist || doesBoxOverlap) {
      return false;
    }

    this._players.forEach((player, index) => {
      if (playerInBox(player, _conversationArea.boundingBox)) {
        _conversationArea.occupantsByID.push(player.id);
        const newPlayer: Player = player;
        newPlayer.activeConversationArea = _conversationArea;
        this._players[index] = newPlayer;
      }
    });
    this._conversationAreas.push(_conversationArea);
    this._listeners.forEach(listener => {
      listener.onConversationAreaUpdated(_conversationArea);
    });

    return true;
  }

  private checkBoxesOverlap(box: BoundingBox): boolean {
    function boxOverlap(first: BoundingBox, second: BoundingBox) {
      const leftFirst = first.x - first.width / 2;
      const rightFirst = first.x + first.width / 2;
      const topFirst = first.y + first.height / 2;
      const botFirst = first.y - first.height / 2;
      const leftSecond = second.x - second.width / 2;
      const rightSecond = second.x + second.width / 2;
      const topSecond = second.y + second.height / 2;
      const botSecond = second.y - second.height / 2;

      if (
        leftFirst < rightSecond &&
        rightFirst > leftSecond &&
        topFirst > botSecond &&
        botFirst < topSecond
      ) {
        return true;
      }
      return false;
    }

    let result = false;
    this._conversationAreas.forEach(first => {
      result = result || boxOverlap(first.boundingBox, box);
    });

    return result;
  }

  /**
   * Subscribe to events from this town. Callers should make sure to
   * unsubscribe when they no longer want those events by calling removeTownListener
   *
   * @param listener New listener
   */
  addTownListener(listener: CoveyTownListener): void {
    this._listeners.push(listener);
  }

  /**
   * Unsubscribe from events in this town.
   *
   * @param listener The listener to unsubscribe, must be a listener that was registered
   * with addTownListener, or otherwise will be a no-op
   */
  removeTownListener(listener: CoveyTownListener): void {
    this._listeners = this._listeners.filter(v => v !== listener);
  }

  /**
   * Fetch a player's session based on the provided session token. Returns undefined if the
   * session token is not valid.
   *
   * @param token
   */
  getSessionByToken(token: string): PlayerSession | undefined {
    return this._sessions.find(p => p.sessionToken === token);
  }

  disconnectAllPlayers(): void {
    this._listeners.forEach(listener => listener.onTownDestroyed());
  }
}
