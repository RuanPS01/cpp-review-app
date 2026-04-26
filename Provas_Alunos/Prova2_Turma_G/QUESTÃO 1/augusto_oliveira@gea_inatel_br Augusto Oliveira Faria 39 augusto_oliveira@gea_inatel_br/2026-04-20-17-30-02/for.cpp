#include <iostream>

using namespace std;

int main(){
    //definir a variaveis inicias e a entrada da quantidada de numeroas que seram analisados
    //fazer a separacao do numeros impar e pares e dos positivo e negativos 
    
    int N,num;
    int positivo = 0;
    int negativo = 0;
    int pares =0;
    int impares =0;

    
    cin >> N;
    
    for(int i =0; i < N; i++){
        cin >> num;
        
        if else (num > 0){
           positivo ++;
        }
        else if(num < 0){
             negativo++;
        }
        else if (num % 2 !=0){
          impares++;
          
        }
        else if(num % 2 ==0){
            pares++;
        }
    
    }
    
      
    
    
    
    
    cout << positivo <<endl;
    cout << negativo << endl;
    cout << pares << endl;
    cout << impares << endl;
    
    
    
    return 0;
}