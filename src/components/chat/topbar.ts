import type { AppChatsManager, Channel } from "../../lib/appManagers/appChatsManager";
import type { AppMessagesManager } from "../../lib/appManagers/appMessagesManager";
import type { AppPeersManager } from "../../lib/appManagers/appPeersManager";
import type { AppSidebarRight } from "../sidebarRight";
import type Chat from "./chat";
import { findUpClassName, cancelEvent, attachClickEvent } from "../../helpers/dom";
import mediaSizes, { ScreenSize } from "../../helpers/mediaSizes";
import { isSafari } from "../../helpers/userAgent";
import rootScope from "../../lib/rootScope";
import AvatarElement from "../avatar";
import Button from "../button";
import ButtonIcon from "../buttonIcon";
import ButtonMenuToggle from "../buttonMenuToggle";
import ChatAudio from "./audio";
import ChatPinnedMessage from "./pinnedMessage";
import ChatSearch from "./search";
import { ButtonMenuItemOptions } from "../buttonMenu";
import ListenerSetter from "../../helpers/listenerSetter";
import appStateManager from "../../lib/appManagers/appStateManager";

export default class ChatTopbar {
  container: HTMLDivElement;
  btnBack: HTMLButtonElement;
  chatInfo: HTMLDivElement;
  avatarElement: AvatarElement;
  title: HTMLDivElement;
  subtitle: HTMLDivElement;
  chatUtils: HTMLDivElement;
  btnJoin: HTMLButtonElement;
  btnPinned: HTMLButtonElement;
  btnMute: HTMLButtonElement;
  btnSearch: HTMLButtonElement;
  btnMore: HTMLButtonElement;
  
  public chatAudio: ChatAudio;
  public pinnedMessage: ChatPinnedMessage;

  private setUtilsRAF: number;
  public peerID: number;
  public wasPeerID: number;
  private setPeerStatusInterval: number;

  public listenerSetter: ListenerSetter;

  public menuButtons: (ButtonMenuItemOptions & {verify: () => boolean})[] = [];

  constructor(private chat: Chat, private appSidebarRight: AppSidebarRight, private appMessagesManager: AppMessagesManager, private appPeersManager: AppPeersManager, private appChatsManager: AppChatsManager) {
    this.listenerSetter = new ListenerSetter();
  }

  public construct() {
    this.chat.log.error('Topbar construction');

    this.container = document.createElement('div');
    this.container.classList.add('sidebar-header', 'topbar');

    this.btnBack = ButtonIcon('back sidebar-close-button', {noRipple: true});

    // * chat info section
    this.chatInfo = document.createElement('div');
    this.chatInfo.classList.add('chat-info');

    const person = document.createElement('div');
    person.classList.add('person');

    const content = document.createElement('div');
    content.classList.add('content');

    const top = document.createElement('div');
    top.classList.add('top');

    this.title = document.createElement('div');
    this.title.classList.add('user-title');

    top.append(this.title);

    const bottom = document.createElement('div');
    bottom.classList.add('bottom');

    if(this.subtitle) {
      bottom.append(this.subtitle);
    }

    content.append(top, bottom);
    if(this.avatarElement) {
      person.append(this.avatarElement);
    }

    person.append(content);
    this.chatInfo.append(person);

    // * chat utils section
    this.chatUtils = document.createElement('div');
    this.chatUtils.classList.add('chat-utils');

    this.chatAudio = new ChatAudio(this, this.chat, this.appMessagesManager, this.appPeersManager);

    if(this.menuButtons.length) {
      this.btnMore = ButtonMenuToggle({listenerSetter: this.listenerSetter}, 'bottom-left', this.menuButtons, () => {
        this.menuButtons.forEach(button => {
          button.element.classList.toggle('hide', !button.verify());
        });
      });
    }

    this.chatUtils.append(...[this.chatAudio ? this.chatAudio.divAndCaption.container : null, this.pinnedMessage ? this.pinnedMessage.pinnedMessageContainer.divAndCaption.container : null, this.btnJoin, this.btnPinned, this.btnMute, this.btnSearch, this.btnMore].filter(Boolean));

    this.container.append(this.btnBack, this.chatInfo, this.chatUtils);

    // * construction end

    // * fix topbar overflow section

    this.listenerSetter.add(window, 'resize', this.onResize);
    mediaSizes.addListener('changeScreen', this.onChangeScreen);

    this.listenerSetter.add(this.container, 'click', (e) => {
      const pinned: HTMLElement = findUpClassName(e.target, 'pinned-container');
      if(pinned) {
        cancelEvent(e);
        
        const mid = +pinned.dataset.mid;
        if(pinned.classList.contains('pinned-message')) {
          //if(!this.pinnedMessage.locked) {
            this.pinnedMessage.followPinnedMessage(mid);
          //}
        } else {
          const message = this.appMessagesManager.getMessage(mid);
  
          this.chat.setPeer(message.peerID, mid);
        }
      } else {
        this.appSidebarRight.toggleSidebar(true);
      }
    });

    this.listenerSetter.add(this.btnBack, 'click', (e) => {
      cancelEvent(e);
      this.chat.appImManager.setPeer(0);
    });
  }

  public constructPeerHelpers() {
    this.avatarElement = new AvatarElement();
    this.avatarElement.setAttribute('dialog', '1');
    this.avatarElement.setAttribute('clickable', '');

    this.subtitle = document.createElement('div');
    this.subtitle.classList.add('info');

    this.pinnedMessage = new ChatPinnedMessage(this, this.chat, this.appMessagesManager, this.appPeersManager);

    this.btnJoin = Button('btn-primary chat-join hide');
    this.btnJoin.append('SUBSCRIBE');

    this.menuButtons = [{
      icon: 'search',
      text: 'Search',
      onClick: () => {
        new ChatSearch(this, this.chat);
      },
      verify: () => mediaSizes.isMobile
    }, /* {
      icon: 'pinlist',
      text: 'Pinned Messages',
      onClick: () => this.openPinned(false),
      verify: () => mediaSizes.isMobile
    }, */ {
      icon: 'mute',
      text: 'Mute',
      onClick: () => {
        this.appMessagesManager.mutePeer(this.peerID);
      },
      verify: () => rootScope.myID != this.peerID && !this.appMessagesManager.isPeerMuted(this.peerID)
    }, {
      icon: 'unmute',
      text: 'Unmute',
      onClick: () => {
        this.appMessagesManager.mutePeer(this.peerID);
      },
      verify: () => rootScope.myID != this.peerID && this.appMessagesManager.isPeerMuted(this.peerID)
    }, {
      icon: 'select',
      text: 'Select Messages',
      onClick: () => {
        this.chat.selection.toggleSelection(true, true);
      },
      verify: () => !this.chat.selection.isSelecting
    }, {
      icon: 'select',
      text: 'Clear Selection',
      onClick: () => {
        this.chat.selection.cancelSelection();
      },
      verify: () => this.chat.selection.isSelecting
    }, {
      icon: 'delete danger',
      text: 'Delete and Leave',
      onClick: () => {},
      verify: () => true
    }];

    this.btnPinned = ButtonIcon('pinlist');
    this.btnMute = ButtonIcon('mute');
    this.btnSearch = ButtonIcon('search');

    this.listenerSetter.add(this.btnPinned, 'click', (e) => {
      cancelEvent(e);
      this.openPinned(true);
    });

    this.listenerSetter.add(this.btnSearch, 'click', (e) => {
      cancelEvent(e);
      if(this.peerID) {
        this.appSidebarRight.searchTab.open(this.peerID);
      }
    });

    this.listenerSetter.add(this.btnMute, 'click', (e) => {
      cancelEvent(e);
      this.appMessagesManager.mutePeer(this.peerID);
    });

    attachClickEvent(this.btnJoin, (e) => {
      cancelEvent(e);

      this.btnJoin.setAttribute('disabled', 'true');
      this.appChatsManager.joinChannel(-this.peerID).finally(() => {
        this.btnJoin.removeAttribute('disabled');
      });
    //});
    }, {listenerSetter: this.listenerSetter});

    this.listenerSetter.add(rootScope, 'chat_update', (e) => {
      const peerID: number = e.detail;
      if(this.peerID == -peerID) {
        const chat = this.appChatsManager.getChat(peerID) as Channel/*  | Chat */;
        
        this.btnJoin.classList.toggle('hide', !(chat as Channel)?.pFlags?.left);
        this.setUtilsWidth();
      }
    });

    this.listenerSetter.add(rootScope, 'dialog_notify_settings', (e) => {
      const peerID = e.detail;

      if(peerID == this.peerID) {
        this.setMutedState();
      }
    });

    this.listenerSetter.add(rootScope, 'peer_typings', (e) => {
      const {peerID} = e.detail;

      if(this.peerID == peerID) {
        this.setPeerStatus();
      }
    });

    this.listenerSetter.add(rootScope, 'user_update', (e) => {
      const userID = e.detail;

      if(this.peerID == userID) {
        this.setPeerStatus();
      }
    });

    this.chat.addListener('setPeer', (mid, isTopMessage) => {
      if(isTopMessage) {
        this.pinnedMessage.unsetScrollDownListener();
        this.pinnedMessage.testMid(mid, 0); // * because slider will not let get bubble by document.elementFromPoint
      } else if(!this.pinnedMessage.locked) {
        this.pinnedMessage.handleFollowingPinnedMessage();
        this.pinnedMessage.testMid(mid);
      }
    });

    this.setPeerStatusInterval = window.setInterval(this.setPeerStatus, 60e3);

    return this;
  }

  public openPinned(byCurrent: boolean) {
    this.chat.appImManager.setInnerPeer(this.peerID, byCurrent ? +this.pinnedMessage.pinnedMessageContainer.divAndCaption.container.dataset.mid : 0, 'pinned');
  }

  private onResize = () => {
    this.setUtilsWidth(true);
  };

  private onChangeScreen = (from: ScreenSize, to: ScreenSize) => {
    this.chatAudio && this.chatAudio.divAndCaption.container.classList.toggle('is-floating', to == ScreenSize.mobile);
    this.pinnedMessage && this.pinnedMessage.onChangeScreen(from, to);
    this.setUtilsWidth(true);
  };

  public destroy() {
    this.chat.log.error('Topbar destroying');

    this.listenerSetter.removeAll();
    mediaSizes.removeListener('changeScreen', this.onChangeScreen);
    window.clearInterval(this.setPeerStatusInterval);
    
    if(this.pinnedMessage) {
      this.pinnedMessage.destroy(); // * возможно это можно не делать
    }

    delete this.chatAudio;
    delete this.pinnedMessage;
  }

  public setPeer(peerID: number) {
    this.wasPeerID = this.peerID;
    this.peerID = peerID;

    this.container.style.display = peerID ? '' : 'none';
  }

  public finishPeerChange(isTarget: boolean, isJump: boolean, lastMsgID: number) {
    const peerID = this.peerID;

    if(this.avatarElement) {
      this.avatarElement.setAttribute('peer', '' + peerID);
      this.avatarElement.update();
    }

    this.container.classList.remove('is-pinned-shown');

    const isBroadcast = this.appPeersManager.isBroadcast(peerID);

    this.btnMute && this.btnMute.classList.toggle('hide', !isBroadcast);
    this.btnJoin && this.btnJoin.classList.toggle('hide', !this.appChatsManager.getChat(-peerID)?.pFlags?.left);
    this.setUtilsWidth();

    const middleware = this.chat.bubbles.getMiddleware();
    if(this.pinnedMessage) { // * replace with new one
      if(this.wasPeerID) { // * change
        const newPinnedMessage = new ChatPinnedMessage(this, this.chat, this.appMessagesManager, this.appPeersManager);
        this.pinnedMessage.pinnedMessageContainer.divAndCaption.container.replaceWith(newPinnedMessage.pinnedMessageContainer.divAndCaption.container);
        this.pinnedMessage.destroy();
        this.pinnedMessage = newPinnedMessage;
      }
      
      appStateManager.getState().then((state) => {
        if(!middleware()) return;

        this.pinnedMessage.hidden = !!state.hiddenPinnedMessages[peerID];

        if(!isTarget) {
          this.pinnedMessage.setCorrectIndex(0);
        }
      });
    }

    window.requestAnimationFrame(() => {
      this.setTitle();
      this.setPeerStatus(true);
      this.setMutedState();
    });
  }

  public setTitle(count?: number) {
    let title = '';
    if(this.chat.type == 'pinned') {
      title = count === -1 ? 'Pinned Messages' : (count === 1 ? 'Pinned Message' : (count + ' Pinned Messages'));
      
      if(count === undefined) {
        this.appMessagesManager.getSearchCounters(this.peerID, [{_: 'inputMessagesFilterPinned'}]).then(result => {
          this.setTitle(result[0].count);
        });
      }
    } else {
      if(this.peerID == rootScope.myID) title = 'Saved Messages';
      else title = this.appPeersManager.getPeerTitle(this.peerID);
    }
    
    this.title.innerHTML = title;
  }

  public setMutedState() {
    if(!this.btnMute) return;

    const peerID = this.peerID;
    let muted = this.appMessagesManager.isPeerMuted(peerID);
    if(this.appPeersManager.isBroadcast(peerID)) { // not human
      this.btnMute.classList.remove('tgico-mute', 'tgico-unmute');
      this.btnMute.classList.add(muted ? 'tgico-unmute' : 'tgico-mute');
      this.btnMute.style.display = '';
    } else {
      this.btnMute.style.display = 'none';
    }
  }

  // ! У МЕНЯ ПРОСТО СГОРЕЛО, САФАРИ КОНЧЕННЫЙ БРАУЗЕР - ЕСЛИ НЕ СКРЫВАТЬ БЛОК, ТО ПРИ ПЕРЕВОРОТЕ ЭКРАНА НА АЙФОНЕ БЛОК БУДЕТ НЕПРАВИЛЬНО ШИРИНЫ, ДАЖЕ БЕЗ ЭТОЙ ФУНКЦИИ!
  public setUtilsWidth = (resize = false) => {
    //return;
    if(this.setUtilsRAF) window.cancelAnimationFrame(this.setUtilsRAF);

    if(isSafari && resize) {
      this.chatUtils.classList.add('hide');
    }

    //mutationObserver.disconnect();
    this.setUtilsRAF = window.requestAnimationFrame(() => {
      
      //mutationRAF = window.requestAnimationFrame(() => {
        
        //setTimeout(() => {
          if(isSafari && resize) {
            this.chatUtils.classList.remove('hide');
          }
          /* this.chatInfo.style.removeProperty('--utils-width');
          void this.chatInfo.offsetLeft; // reflow */
          const width = /* chatUtils.scrollWidth */this.chatUtils.getBoundingClientRect().width;
          this.chat.log('utils width:', width);
          this.chatInfo.style.setProperty('--utils-width', width + 'px');
          //this.chatInfo.classList.toggle('have-utils-width', !!width);
        //}, 0);
        
        this.setUtilsRAF = 0;

        //mutationObserver.observe(chatUtils, observeOptions);
      //});
    });
  };

  public setPeerStatus = (needClear = false) => {
    if(!this.subtitle) return;

    const peerID = this.peerID;
    if(needClear) {
      this.subtitle.innerHTML = '';
    }

    this.chat.appImManager.getPeerStatus(this.peerID).then((subtitle) => {
      if(peerID != this.peerID) {
        return;
      }

      this.subtitle.innerHTML = subtitle;
    });
  };
}