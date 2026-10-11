<script lang="ts" module>
	/** What the content of a drag item attaches and shows. */
	export type DragItem = {
		/** The element that moves and takes drops. */
		attach: (node: HTMLElement) => () => void;
		/** The grip that starts a drag. */
		handle: (node: HTMLElement) => () => void;
		/** This item is being dragged. */
		readonly source: boolean;
		/** Another item is being dragged over this one. */
		readonly target: boolean;
	};
</script>

<script lang="ts">
	import { createDraggable, createDroppable } from '@dnd-kit/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		id: string;
		/** Shown in the drag overlay. */
		label: string;
		disabled?: boolean;
		children: Snippet<[DragItem]>;
	};

	let { id, label, disabled = false, children }: Props = $props();

	// Both read their input through getters, so id and disabled follow the props.
	const draggable = createDraggable({
		get id() {
			return id;
		},
		get disabled() {
			return disabled;
		},
		get data() {
			return { label };
		}
	});
	const droppable = createDroppable({
		get id() {
			return id;
		},
		get disabled() {
			return disabled;
		}
	});

	const item: DragItem = {
		attach(node) {
			const detachDrag = draggable.attach(node);
			const detachDrop = droppable.attach(node);
			return () => {
				detachDrag();
				detachDrop();
			};
		},
		handle: (node) => draggable.attachHandle(node),
		get source() {
			return draggable.isDragSource;
		},
		get target() {
			return droppable.isDropTarget && !draggable.isDragSource;
		}
	};
</script>

{@render children(item)}
