#include <iostream>

using namespace std;

int main(){
    
    int M;
    
    int cont=0;
    int soma=0;
    
    do{
        cin >> M;
        soma=soma+M;
       
        if(M==10){
            cont++;
        }
    }
    while (M!=0);
       
    
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << cont << endl;
    
    return 0;
}