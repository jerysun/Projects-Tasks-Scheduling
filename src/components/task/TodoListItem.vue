<template>
  <div
    class="bg-white shadow-sm rounded-md text-gray-700 p-4 flex flex-col"
    :class="{ 'opacity-25 line-through': task.done }"
  >
    <div class="p-4 border-b border-gray-100">{{ task.description }}</div>
    <div class="p-4 bg-white flex-grow">
      <BaseCheckbox
        class="mb-2"
        @update:model-value="$emit('update:done', $event)"
        :model-value="done"
        >Done</BaseCheckbox
      >
      <BaseCheckbox
        @update:model-value="$emit('update:priority', $event)"
        :model-value="priority"
        >Prioritized</BaseCheckbox
      >
    </div>
    <TodoListItemMenu />
  </div>
</template>

<script setup>
import { provide } from 'vue';
import BaseCheckbox from './../base/BaseCheckbox.vue';
import TodoListItemMenu from './TodoListItemMenu.vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  projectId: String,
  done: Boolean,
  priority: Boolean
});
provide('task', props.task);
provide('projectId', props.projectId);
defineEmits(['update:done', 'update:priority']);
</script>
