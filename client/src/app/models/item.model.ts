import { StjornaCategoryModel } from '../models/category.model';

export interface StjornaItemModel {
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