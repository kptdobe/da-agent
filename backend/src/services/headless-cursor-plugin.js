/**
 * Headless Cursor Plugin for Y-ProseMirror
 * Adapted from helix-collab
 */

import * as Y from 'yjs';
import { AllSelection, Plugin } from 'prosemirror-state';
import {
  absolutePositionToRelativePosition,
  yCursorPluginKey,
  ySyncPluginKey,
} from 'y-prosemirror';

/**
 * A prosemirror plugin that listens to awareness information on Yjs.
 * This requires that a `prosemirrorPlugin` is also bound to the prosemirror.
 * It updates the awareness when the prosemirror selection changes.
 */
export function yHeadlessCursorPlugin(awareness) {
  return new Plugin({
    key: yCursorPluginKey,
    state: {
      init() {
        return {};
      },
      apply() {
        return {};
      },
    },
    view: (view) => {
      const updateCursorInfo = () => {
        const ystate = ySyncPluginKey.getState(view.state);
        const current = awareness.getLocalState() || {};
        const { selection } = view.state;

        // Suppress AllSelection (initial state before doc is loaded)
        if (selection instanceof AllSelection) {
          return;
        }

        const anchor = absolutePositionToRelativePosition(
          selection.anchor,
          ystate.type,
          ystate.binding.mapping,
        );

        const head = absolutePositionToRelativePosition(
          selection.head,
          ystate.type,
          ystate.binding.mapping,
        );

        if (
          current.cursor == null ||
          !Y.compareRelativePositions(
            Y.createRelativePositionFromJSON(current.cursor.anchor),
            anchor,
          ) ||
          !Y.compareRelativePositions(
            Y.createRelativePositionFromJSON(current.cursor.head),
            head,
          )
        ) {
          awareness.setLocalStateField('cursor', {
            anchor,
            head,
          });
        }
      };

      return {
        update: updateCursorInfo,
        destroy: () => {
          awareness.setLocalStateField('cursor', null);
        },
      };
    },
  });
}

