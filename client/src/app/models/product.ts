import { Category } from './category';

export interface Product {
    _id: string;
    name: string;
    category: Category['_id'];
    price: number;
    description: string;
    active: boolean;
    image: string;
    imageUrl: string;
    created: string;
    createdUser: string;
    updated: string;
    updatedUser: string;
}
