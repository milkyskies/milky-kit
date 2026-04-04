export interface PostApi {
	id: string;
	title: string;
	body: string;
	created_at: string;
	updated_at: string;
}

export class Post {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;

	constructor(params: {
		id: string;
		title: string;
		body: string;
		createdAt: Date;
		updatedAt: Date;
	}) {
		this.id = params.id;
		this.title = params.title;
		this.body = params.body;
		this.createdAt = params.createdAt;
		this.updatedAt = params.updatedAt;
	}

	static fromApi(data: PostApi): Post {
		return new Post({
			id: data.id,
			title: data.title,
			body: data.body,
			createdAt: new Date(data.created_at),
			updatedAt: new Date(data.updated_at),
		});
	}
}
