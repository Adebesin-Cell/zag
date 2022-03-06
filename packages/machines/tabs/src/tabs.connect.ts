import { StateMachine as S } from "@ui-machines/core"
import { EventKeyMap, getEventKey } from "@ui-machines/dom-utils"
import { normalizeProp, PropTypes, ReactPropTypes } from "@ui-machines/types"
import { isSafari } from "@ui-machines/utils"
import { dom } from "./tabs.dom"
import { MachineContext, MachineState, TabProps } from "./tabs.types"

export function connect<T extends PropTypes = ReactPropTypes>(
  state: S.State<MachineContext, MachineState>,
  send: (event: S.Event<S.AnyEventObject>) => void,
  normalize = normalizeProp,
) {
  const { context: ctx } = state

  return {
    value: ctx.value,
    focusedValue: ctx.focusedValue,
    setValue(value: string) {
      send({ type: "SET_VALUE", value })
    },

    tablistProps: normalize.element<T>({
      "data-part": "tablist",
      id: dom.getTablistId(ctx),
      role: "tablist",
      "aria-orientation": ctx.orientation,
      onKeyDown(event) {
        const keyMap: EventKeyMap = {
          ArrowDown() {
            send("ARROW_DOWN")
          },
          ArrowUp() {
            send("ARROW_UP")
          },
          ArrowLeft() {
            send("ARROW_LEFT")
          },
          ArrowRight() {
            send("ARROW_RIGHT")
          },
          Home() {
            send("HOME")
          },
          End() {
            send("END")
          },
          Enter() {
            send({ type: "ENTER", value: ctx.focusedValue })
          },
        }

        let key = getEventKey(event, ctx)
        const exec = keyMap[key]

        if (exec) {
          event.preventDefault()
          exec(event)
        }
      },
    }),

    getTabProps(props: TabProps) {
      const { value, disabled } = props
      const selected = ctx.value === value

      return normalize.button<T>({
        "data-part": "tab",
        role: "tab",
        type: "button",
        disabled,
        "data-value": value,
        "aria-selected": selected,
        "aria-controls": dom.getPanelId(ctx, value),
        "data-ownedby": dom.getTablistId(ctx),
        id: dom.getTabId(ctx, value),
        tabIndex: selected ? 0 : -1,
        onFocus() {
          send({ type: "TAB_FOCUS", value })
        },
        onBlur(event) {
          const target = event.relatedTarget as HTMLElement | null
          if (target?.getAttribute("role") !== "tab") {
            send({ type: "TAB_BLUR" })
          }
        },
        onClick(event) {
          if (disabled) return
          if (isSafari()) {
            event.currentTarget.focus()
          }
          send({ type: "TAB_CLICK", value })
        },
      })
    },

    getTabPanelProps({ value }: { value: string }) {
      const selected = ctx.value === value
      return normalize.element<T>({
        "data-part": "tabpanel",
        id: dom.getPanelId(ctx, value),
        tabIndex: 0,
        "aria-labelledby": dom.getTabId(ctx, value),
        role: "tabpanel",
        "data-ownedby": dom.getTablistId(ctx),
        hidden: !selected,
      })
    },

    tabIndicatorProps: normalize.element<T>({
      "data-part": "tab-indicator",
      style: {
        position: "absolute",
        willChange: "left, right, top, bottom, width, height",
        transitionProperty: "left, right, top, bottom, width, height",
        transitionDuration: ctx.measuredRect ? "200ms" : "0ms",
        ...ctx.indicatorRect,
      },
    }),
  }
}
