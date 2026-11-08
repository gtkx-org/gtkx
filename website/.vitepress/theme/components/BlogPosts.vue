<script setup lang="ts">
import { data as posts } from "../../blog.data.js";
</script>

<template>
    <ul>
        <li v-for="post in posts" :key="post.url">
            <a :href="post.url">{{ post.label }}</a> &middot; {{ post.displayDate }}
        </li>
    </ul>
</template>
