import { getPostsQueryOptions } from "@/services/api/post/get-posts-query-options";
import { useDeletePost } from "@/services/api/post/use-delete-post";
import { usePostPost } from "@/services/api/post/use-post-post";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";

export const Route = createFileRoute("/_layout/posts")({
	component: PostsPage,
});

function PostsPage() {
	return (
		<div className="max-w-2xl mx-auto space-y-8">
			<h1 className="text-2xl font-bold">Posts</h1>
			<CreatePostForm />
			<Suspense fallback={<div>Loading posts...</div>}>
				<PostsList />
			</Suspense>
		</div>
	);
}

function CreatePostForm() {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const createPost = usePostPost();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		createPost.mutate(
			{ title: title.trim(), body: body.trim() },
			{
				onSuccess: () => {
					setTitle("");
					setBody("");
				},
			},
		);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<input
				type="text"
				placeholder="Title"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				className="w-full border rounded px-3 py-2"
			/>
			<textarea
				placeholder="Body"
				value={body}
				onChange={(e) => setBody(e.target.value)}
				className="w-full border rounded px-3 py-2"
				rows={3}
			/>
			<button
				type="submit"
				disabled={createPost.isPending}
				className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
			>
				{createPost.isPending ? "Creating..." : "Create Post"}
			</button>
		</form>
	);
}

function PostsList() {
	const { data: posts } = useSuspenseQuery(getPostsQueryOptions());
	const deletePost = useDeletePost();

	if (posts.length === 0) {
		return <p className="text-gray-500">No posts yet. Create one above!</p>;
	}

	return (
		<ul className="space-y-4">
			{posts.map((post) => (
				<li
					key={post.id}
					className="border rounded p-4 flex justify-between items-start"
				>
					<div>
						<h2 className="font-semibold">{post.title}</h2>
						{post.body && <p className="text-gray-600 mt-1">{post.body}</p>}
					</div>
					<button
						type="button"
						onClick={() => deletePost.mutate({ id: post.id })}
						disabled={deletePost.isPending}
						className="text-red-600 hover:text-red-800 text-sm"
					>
						Delete
					</button>
				</li>
			))}
		</ul>
	);
}
