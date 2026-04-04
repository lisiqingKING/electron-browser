<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()
</script>

<template>
  <div class="url-bar">
    <input
      :value="props.modelValue"
      type="text"
      placeholder="输入网址..."
      class="url-input"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="emit('submit')"
    />
  </div>
</template>

<style scoped>
.url-bar {
  padding: 12px 20px;
  height: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.url-input {
  height: 100%;
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #e4e7eb;
  font-size: 14px;
  outline: none;
}

.url-input:focus {
  border-color: #6366f1;
}

.url-input::placeholder {
  color: #64748b;
}
</style>
