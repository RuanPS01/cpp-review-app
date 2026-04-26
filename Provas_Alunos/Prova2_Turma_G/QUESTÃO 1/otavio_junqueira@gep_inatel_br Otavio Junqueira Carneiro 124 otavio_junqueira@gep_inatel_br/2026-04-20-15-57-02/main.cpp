#include <iostream>

using namespace std;

int main ()
{
    int N;
    cin >> N;
    
    int inteiros[100], pares=0, impares=0, positivos=0, negativos=0;
    
    for(int i =0; i < N; i++)
    {
        cin >> inteiros[i];
    }
    
    for(int i =0 ; i< N; i++)
    {
        if(inteiros[i] %2 == 0){
            
            pares++;
        }else
        if(inteiros[i] % 2 != 0)
        {
            impares++;
        }
    }
    for(int i = 0; i < N; i++)
    {
        if(inteiros[i] > 0){
            positivos++;
        }else 
        if(inteiros[i] < 0)
        {
            negativos++;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return 0;
}