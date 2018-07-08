import { StjornaCategoryModel } from '../models/category.model';

export interface StjornaProductModel {
    _id: string,
    name: string,
    category: StjornaCategoryModel["_id"],
    price: number,
    description: string,
    active: boolean,
    image: string,
    imageUrl: string,
    created: string,
    createdUser: string,
    updated: string,
    updatedUser: string,
}
